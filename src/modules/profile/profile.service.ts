import bcrypt from "bcryptjs";
import { getPool, sql } from "../../db/sqlserver";
import { HttpError } from "../../shared/http-error";

export async function getMyProfile(userId: number) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("user_id", sql.Int, userId)
    .query(`
      SELECT
        u.user_id,
        u.username,
        u.display_name,
        u.email,
        u.is_active,
        u.is_multi_branch,
        u.default_branch_id,
        b.branch_name,
        u.last_login_at,
        u.created_at
      FROM sec.users u
      LEFT JOIN crm.branches b
        ON b.company_id = u.company_id
       AND b.branch_id = u.default_branch_id
      WHERE u.user_id = @user_id;
    `);

  const user = result.recordset[0];
  if (!user) {
    throw new HttpError(404, "Usuario no encontrado");
  }

  const rolesResult = await pool
    .request()
    .input("user_id", sql.Int, userId)
    .query(`
      SELECT r.role_id, r.role_name, r.role_description
      FROM sec.user_roles ur
      INNER JOIN sec.roles r ON r.role_id = ur.role_id
      WHERE ur.user_id = @user_id;
    `);

  const permsResult = await pool
    .request()
    .input("user_id", sql.Int, userId)
    .query<{ permission_key: string }>(`
      SELECT DISTINCT p.permission_key
      FROM sec.user_roles ur
      INNER JOIN sec.role_permissions rp ON rp.role_id = ur.role_id
      INNER JOIN sec.permissions p ON p.permission_id = rp.permission_id
      WHERE ur.user_id = @user_id;
    `);

  return {
    user_id: user.user_id,
    username: user.username,
    display_name: user.display_name,
    email: user.email,
    is_active: user.is_active,
    is_multi_branch: user.is_multi_branch,
    default_branch_id: user.default_branch_id,
    branch_name: user.branch_name,
    last_login_at: user.last_login_at,
    created_at: user.created_at,
    roles: rolesResult.recordset,
    permissions: permsResult.recordset.map((p) => p.permission_key),
  };
}

export async function updateMyProfile(userId: number, input: {
  display_name?: string;
  email?: string;
}) {
  const pool = await getPool();

  const existing = await pool
    .request()
    .input("user_id", sql.Int, userId)
    .query(`
      SELECT user_id FROM sec.users WHERE user_id = @user_id;
    `);

  if (!existing.recordset[0]) {
    throw new HttpError(404, "Usuario no encontrado");
  }

  const sets: string[] = [];
  const request = pool.request().input("user_id", sql.Int, userId);

  if (input.display_name !== undefined) {
    sets.push("display_name = @display_name");
    request.input("display_name", sql.NVarChar(140), input.display_name);
  }
  if (input.email !== undefined) {
    sets.push("email = @email");
    request.input("email", sql.NVarChar(160), input.email || null);
  }

  if (sets.length === 0) {
    throw new HttpError(400, "No hay cambios para actualizar");
  }

  sets.push("updated_at = SYSUTCDATETIME()");

  await request.query(`
    UPDATE sec.users SET ${sets.join(", ")}
    WHERE user_id = @user_id;
  `);
}

export async function changeMyPassword(userId: number, currentPassword: string, newPassword: string): Promise<void> {
  const pool = await getPool();

  const user = await pool
    .request()
    .input("user_id", sql.Int, userId)
    .query<{ password_hash: string }>(`
      SELECT password_hash FROM sec.users WHERE user_id = @user_id;
    `);

  if (!user.recordset[0]) {
    throw new HttpError(404, "Usuario no encontrado");
  }

  const passwordHash = user.recordset[0].password_hash;
  let passwordOk = false;

  if (passwordHash.startsWith("$2")) {
    passwordOk = await bcrypt.compare(currentPassword, passwordHash);
  } else {
    passwordOk = currentPassword === passwordHash;
  }

  if (!passwordOk) {
    throw new HttpError(400, "La contrasena actual es incorrecta");
  }

  const newHash = await bcrypt.hash(newPassword, 12);

  await pool
    .request()
    .input("user_id", sql.Int, userId)
    .input("password_hash", sql.NVarChar(255), newHash)
    .query(`
      UPDATE sec.users
      SET password_hash = @password_hash,
          updated_at = SYSUTCDATETIME()
      WHERE user_id = @user_id;
    `);
}
