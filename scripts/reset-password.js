require("dotenv").config();
const sql = require("mssql");
const bcrypt = require("bcryptjs");

async function run() {
  const username = process.argv[2];
  const newPassword = process.argv[3];

  if (!username || !newPassword) {
    console.error("Uso: npm run password:reset -- <username> <newPassword>");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

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

  const updateResult = await pool
    .request()
    .input("username", sql.VarChar(50), username)
    .input("password_hash", sql.NVarChar(255), passwordHash)
    .query(`
      UPDATE sec.users
      SET password_hash = @password_hash,
          updated_at = SYSUTCDATETIME()
      WHERE username = @username;

      SELECT @@ROWCOUNT AS affected_rows;
    `);

  const affected = updateResult.recordset[0]?.affected_rows || 0;

  if (affected === 0) {
    console.error("No se actualizó ningún usuario. Verifica el username.");
    await pool.close();
    process.exit(1);
  }

  console.log({ username, updated: true, affected_rows: affected });
  await pool.close();
}

run().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
