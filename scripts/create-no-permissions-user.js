require("dotenv").config();
const sql = require("mssql");
const bcrypt = require("bcryptjs");

async function run() {
  const username = process.argv[2] || "operador_lectura";
  const password = process.argv[3] || "Lectura123!";
  const displayName = process.argv[4] || "Operador Solo Lectura";

  const pool = await sql.connect({
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    server: process.env.SQL_HOST,
    port: Number(process.env.SQL_PORT),
    database: process.env.SQL_DATABASE,
    options: {
      encrypt: process.env.SQL_ENCRYPT === "true",
      trustServerCertificate: process.env.SQL_TRUST_CERT === "true",
      enableArithAbort: true,
      instanceName: process.env.SQL_INSTANCE || undefined,
    },
  });

  const companyResult = await pool.request().query("SELECT TOP 1 company_id FROM sec.companies ORDER BY company_id;");
  const companyId = companyResult.recordset[0]?.company_id;
  if (!companyId) {
    throw new Error("No se encontró company_id");
  }

  const branchResult = await pool
    .request()
    .input("company_id", sql.Int, companyId)
    .query("SELECT TOP 1 branch_id FROM crm.branches WHERE company_id = @company_id ORDER BY branch_id;");
  const branchId = branchResult.recordset[0]?.branch_id || null;

  const existing = await pool
    .request()
    .input("company_id", sql.Int, companyId)
    .input("username", sql.VarChar(50), username.toUpperCase())
    .query("SELECT user_id FROM sec.users WHERE company_id = @company_id AND username = @username;");

  const hash = await bcrypt.hash(password, 12);

  if (existing.recordset[0]?.user_id) {
    await pool
      .request()
      .input("user_id", sql.Int, existing.recordset[0].user_id)
      .input("password_hash", sql.NVarChar(255), hash)
      .query("UPDATE sec.users SET password_hash = @password_hash, updated_at = SYSUTCDATETIME() WHERE user_id = @user_id;");

    await pool
      .request()
      .input("user_id", sql.Int, existing.recordset[0].user_id)
      .query("DELETE FROM sec.user_roles WHERE user_id = @user_id;");

    console.log({
      username: username.toUpperCase(),
      password,
      updated: true,
      roles: [],
      note: "Usuario actualizado sin permisos",
    });
    await pool.close();
    return;
  }

  await pool
    .request()
    .input("company_id", sql.Int, companyId)
    .input("username", sql.VarChar(50), username.toUpperCase())
    .input("display_name", sql.NVarChar(140), displayName)
    .input("password_hash", sql.NVarChar(255), hash)
    .input("default_branch_id", sql.Int, branchId)
    .query(`
      INSERT INTO sec.users (
        company_id, username, display_name, password_hash, default_branch_id,
        is_multi_branch, is_active, created_at, updated_at
      ) VALUES (
        @company_id, @username, @display_name, @password_hash, @default_branch_id,
        0, 1, SYSUTCDATETIME(), SYSUTCDATETIME()
      );
    `);

  console.log({
    username: username.toUpperCase(),
    password,
    created: true,
    roles: [],
    note: "Usuario creado sin permisos",
  });

  await pool.close();
}

run().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
