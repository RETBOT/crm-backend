require("dotenv").config();
const sql = require("mssql");

async function run() {
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
  if (!companyId) throw new Error("No se encontró company_id");

  const permissions = [
    ["users.manage", "Administrar usuarios"],
    ["roles.manage", "Administrar roles"],
    ["scope.manage", "Administrar alcance de datos"],
    ["customers.create", "Crear clientes"],
    ["customers.update", "Actualizar clientes"],
    ["customers.delete", "Inactivar clientes"],
    ["prospects.create", "Crear prospectos"],
    ["prospects.update", "Actualizar prospectos"],
    ["prospects.delete", "Inactivar prospectos"],
    ["prospects.convert", "Convertir prospectos a cliente"],
  ];

  for (const [key, desc] of permissions) {
    await pool
      .request()
      .input("permission_key", sql.VarChar(80), key)
      .input("permission_description", sql.NVarChar(200), desc)
      .query(`
        IF NOT EXISTS (SELECT 1 FROM sec.permissions WHERE permission_key = @permission_key)
        BEGIN
          INSERT INTO sec.permissions (permission_key, permission_description)
          VALUES (@permission_key, @permission_description)
        END
      `);
  }

  const roles = [
    ["admin", "Administrador general"],
    ["ventas", "Ejecutivo de ventas"],
    ["supervisor", "Supervisor comercial"],
  ];

  for (const [name, desc] of roles) {
    await pool
      .request()
      .input("company_id", sql.Int, companyId)
      .input("role_name", sql.VarChar(40), name)
      .input("role_description", sql.NVarChar(200), desc)
      .query(`
        IF NOT EXISTS (
          SELECT 1 FROM sec.roles WHERE company_id = @company_id AND role_name = @role_name
        )
        BEGIN
          INSERT INTO sec.roles (company_id, role_name, role_description, is_active)
          VALUES (@company_id, @role_name, @role_description, 1)
        END
      `);
  }

  const roleResult = await pool.request().input("company_id", sql.Int, companyId).query(`
    SELECT role_id, role_name
    FROM sec.roles
    WHERE company_id = @company_id
      AND role_name IN ('admin', 'ventas', 'supervisor');
  `);

  const roleByName = Object.fromEntries(roleResult.recordset.map((r) => [r.role_name, r.role_id]));

  async function assignRolePermissions(roleName, permissionKeys) {
    const roleId = roleByName[roleName];
    if (!roleId) return;
    for (const key of permissionKeys) {
      await pool
        .request()
        .input("role_id", sql.Int, roleId)
        .input("permission_key", sql.VarChar(80), key)
        .query(`
          INSERT INTO sec.role_permissions (role_id, permission_id)
          SELECT @role_id, p.permission_id
          FROM sec.permissions p
          WHERE p.permission_key = @permission_key
            AND NOT EXISTS (
              SELECT 1 FROM sec.role_permissions rp
              WHERE rp.role_id = @role_id
                AND rp.permission_id = p.permission_id
            );
        `);
    }
  }

  await assignRolePermissions("admin", permissions.map(([key]) => key));
  await assignRolePermissions("ventas", [
    "customers.create",
    "customers.update",
    "prospects.create",
    "prospects.update",
  ]);
  await assignRolePermissions("supervisor", [
    "customers.create",
    "customers.update",
    "prospects.create",
    "prospects.update",
    "prospects.convert",
  ]);

  const adminUser = await pool
    .request()
    .input("company_id", sql.Int, companyId)
    .query("SELECT TOP 1 user_id FROM sec.users WHERE company_id = @company_id AND username = 'admin';");
  const adminUserId = adminUser.recordset[0]?.user_id;
  if (adminUserId && roleByName.admin) {
    await pool
      .request()
      .input("user_id", sql.Int, adminUserId)
      .input("role_id", sql.Int, roleByName.admin)
      .query(`
        IF NOT EXISTS (SELECT 1 FROM sec.user_roles WHERE user_id = @user_id AND role_id = @role_id)
        BEGIN
          INSERT INTO sec.user_roles (user_id, role_id)
          VALUES (@user_id, @role_id)
        END
      `);
  }

  console.log({ ok: true, companyId, adminRoleId: roleByName.admin || null });
  await pool.close();
}

run().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
