import bcrypt from "bcryptjs";
import CryptoJS from "crypto-js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { env } from "../../config/env";
import { getPool, sql } from "../../db/sqlserver";
import { HttpError } from "../../shared/http-error";
import { sendPasswordResetEmail } from "../../shared/email";

type UserRow = {
  user_id: number;
  company_id: number;
  username: string;
  display_name: string;
  password_hash: string;
  is_multi_branch: boolean;
  branch_id: number | null;
  branch_name: string | null;
  is_active: boolean;
  email: string | null;
  permissions: string[];
};

function decryptPasswordIfPossible(cipherOrPlain: string): string {
  if (!env.appSecretKey) return cipherOrPlain;

  try {
    const key = CryptoJS.enc.Utf8.parse(env.appSecretKey);
    const iv = CryptoJS.enc.Utf8.parse(env.appSecretKey);
    const decrypted = CryptoJS.AES.decrypt(cipherOrPlain, key, {
      iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });

    const asText = decrypted.toString(CryptoJS.enc.Utf8);
    return asText || cipherOrPlain;
  } catch {
    return cipherOrPlain;
  }
}

function signAccessToken(user: UserRow): string {
  return jwt.sign(
    {
      username: user.username,
      company_id: user.company_id,
      permissions: user.permissions,
    },
    env.jwtSecret,
    {
      subject: String(user.user_id),
      expiresIn: `${env.jwtExpiresMinutes}m`,
    }
  );
}

export async function findUserByUsername(username: string): Promise<UserRow | null> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("username", sql.VarChar(50), username.toUpperCase())
    .query<UserRow>(`
      SELECT
        u.user_id,
        u.company_id,
        u.username,
        u.display_name,
        u.password_hash,
        u.is_multi_branch,
        b.branch_id,
        b.branch_name,
        u.is_active,
        u.email
      FROM sec.users u
      LEFT JOIN crm.branches b
        ON b.company_id = u.company_id
       AND b.branch_id = u.default_branch_id
      WHERE u.username = @username;
    `);

  const user = result.recordset[0] ?? null;
  if (!user) return null;

  const permissions = await getUserPermissions(user.user_id);
  return {
    ...user,
    permissions,
  };
}

async function getUserPermissions(userId: number): Promise<string[]> {
  const pool = await getPool();
  const result = await pool.request().input("user_id", sql.Int, userId).query<{ permission_key: string }>(`
    SELECT DISTINCT p.permission_key
    FROM sec.user_roles ur
    INNER JOIN sec.role_permissions rp ON rp.role_id = ur.role_id
    INNER JOIN sec.permissions p ON p.permission_id = rp.permission_id
    WHERE ur.user_id = @user_id;
  `);

  const permissions = result.recordset.map((row) => row.permission_key).filter(Boolean);
  return permissions;
}

export async function validateUser(username: string, encryptedOrPlainPassword: string): Promise<UserRow> {
  const user = await findUserByUsername(username);

  if (!user || !user.is_active) {
    throw new HttpError(401, "Usuario o contraseña incorrectos");
  }

  const candidate = decryptPasswordIfPossible(encryptedOrPlainPassword);

  let passwordOk = false;
  if (user.password_hash.startsWith("$2")) {
    passwordOk = await bcrypt.compare(candidate, user.password_hash);
  } else {
    passwordOk = candidate === user.password_hash || encryptedOrPlainPassword === user.password_hash;
  }

  if (!passwordOk) {
    throw new HttpError(401, "Usuario o contraseña incorrectos");
  }

  await touchLastLogin(user.user_id);
  return user;
}

async function touchLastLogin(userId: number): Promise<void> {
  const pool = await getPool();
  await pool.request().input("user_id", sql.Int, userId).query(`
    UPDATE sec.users
       SET last_login_at = SYSUTCDATETIME(),
           updated_at = SYSUTCDATETIME()
     WHERE user_id = @user_id;
  `);
}

export function buildLoginPayload(user: UserRow) {
  return {
    token: signAccessToken(user),
    username: user.username,
    displayName: user.display_name,
    branchId: user.branch_id,
    branchName: user.branch_name,
    multiBranch: user.is_multi_branch ? 1 : 0,
    permissions: user.permissions,
  };
}

export async function forgotPassword(username: string, email: string): Promise<string> {
  const user = await findUserByUsername(username);

  if (!user || !user.email || user.email.toLowerCase() !== email.toLowerCase()) {
    throw new HttpError(400, "Usuario o Correo Electrónico incorrectos");
  }

  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  const pool = await getPool();
  await pool.request()
    .input("user_id", sql.Int, user.user_id)
    .input("token_hash", sql.NVarChar(255), tokenHash)
    .input("expires_at", sql.DateTime2, expiresAt)
    .query(`
      INSERT INTO sec.password_reset_tokens (user_id, token_hash, expires_at, created_at)
      VALUES (@user_id, @token_hash, @expires_at, SYSUTCDATETIME());
    `);

  const resetLink = `${env.appUrl}/auth/reset-password?token=${token}`;
  await sendPasswordResetEmail(user.email, user.display_name || user.username, resetLink);

  return "Se envió un enlace de recuperación a tu correo electrónico.";
}

export async function resetPasswordWithToken(token: string, newPassword: string): Promise<void> {
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const pool = await getPool();
  const tokenResult = await pool.request()
    .input("token_hash", sql.NVarChar(255), tokenHash)
    .query<{ user_id: number; used_at: Date | null; expires_at: Date }>(`
      SELECT user_id, used_at, expires_at
      FROM sec.password_reset_tokens
      WHERE token_hash = @token_hash
      ORDER BY created_at DESC
      OFFSET 0 ROWS FETCH NEXT 1 ROWS ONLY;
    `);

  const tokenRecord = tokenResult.recordset[0];
  if (!tokenRecord) {
    throw new HttpError(400, "Token de recuperación inválido");
  }

  if (tokenRecord.used_at) {
    throw new HttpError(400, "Este enlace de recuperación ya fue utilizado");
  }

  if (new Date(tokenRecord.expires_at) < new Date()) {
    throw new HttpError(400, "Este enlace de recuperación ha expirado");
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await pool.request()
    .input("user_id", sql.Int, tokenRecord.user_id)
    .input("password_hash", sql.NVarChar(255), hashedPassword)
    .query(`
      UPDATE sec.users
      SET password_hash = @password_hash,
          updated_at = SYSUTCDATETIME()
      WHERE user_id = @user_id;
    `);

  await pool.request()
    .input("token_hash", sql.NVarChar(255), tokenHash)
    .query(`
      UPDATE sec.password_reset_tokens
      SET used_at = SYSUTCDATETIME()
      WHERE token_hash = @token_hash;
    `);
}
