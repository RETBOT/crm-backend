require("dotenv").config();
const sql = require("mssql");
const bcrypt = require("bcryptjs");

async function run() {
  const hash = await bcrypt.hash("123456", 12);

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

  await pool
    .request()
    .input("hash", sql.NVarChar(255), hash)
    .input("username", sql.VarChar(50), "admin")
    .query("UPDATE sec.users SET password_hash=@hash, updated_at=SYSUTCDATETIME() WHERE username=@username;");

  const row = (
    await pool
      .request()
      .query("SELECT username, password_hash FROM sec.users WHERE username='admin';")
  ).recordset[0];

  const ok = await bcrypt.compare("123456", row.password_hash);
  console.log({ username: row.username, password_hash: row.password_hash, compare: ok });

  await pool.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
