require("dotenv").config();
const sql = require("mssql");
const bcrypt = require("bcryptjs");

async function run() {
  const username = process.argv[2];
  const plainPassword = process.argv[3];

  if (!username || !plainPassword) {
    console.error("Uso: npm run password:check -- <username> <password>");
    process.exit(1);
  }

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

  const queryResult = await pool
    .request()
    .input("username", sql.VarChar(50), username)
    .query("SELECT username, password_hash, is_active FROM sec.users WHERE username = @username;");

  const user = queryResult.recordset[0];
  if (!user) {
    console.error("Usuario no encontrado");
    await pool.close();
    process.exit(1);
  }

  const matches = await bcrypt.compare(plainPassword, user.password_hash);
  console.log({ username: user.username, is_active: user.is_active, password_matches: matches });

  await pool.close();
}

run().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
