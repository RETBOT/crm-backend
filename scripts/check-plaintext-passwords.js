const sql = require("mssql");
require("dotenv").config();

async function main() {
  const config = {
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    server: process.env.SQL_HOST,
    port: parseInt(process.env.SQL_PORT || "1433"),
    database: process.env.SQL_DATABASE,
    options: {
      encrypt: process.env.SQL_ENCRYPT === "true",
      trustServerCertificate: process.env.SQL_TRUST_CERT === "true",
      enableArithAbort: true,
    },
  };

  const pool = await sql.connect(config);

  const result = await pool.request().query(`
    SELECT user_id, username, display_name, email, password_hash
    FROM sec.users
    WHERE password_hash NOT LIKE '$2%';
  `);

  const plainUsers = result.recordset;

  if (plainUsers.length === 0) {
    console.log("No users with plaintext passwords found.");
    await pool.close();
    return;
  }

  console.log(`Found ${plainUsers.length} user(s) with plaintext passwords:`);
  plainUsers.forEach((u) => {
    console.log(`  - ${u.username} (${u.display_name}) - ${u.email || "no email"}`);
  });

  console.log("\nTo fix these users, you can:");
  console.log("1. Force password reset for all affected users");
  console.log("2. Run this script with --force-reset to hash their passwords and mark them for reset");

  await pool.close();
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
