import { getPool, sql } from "../src/db/sqlserver";

async function main() {
  const pool = await getPool();

  // Agregar permiso reports.view al rol admin
  await pool.request().query(`
    INSERT INTO sec.role_permissions (role_id, permission_id)
    SELECT r.role_id, p.permission_id
    FROM sec.roles r, sec.permissions p
    WHERE r.role_name = 'admin' 
      AND p.permission_key = 'reports.view'
      AND NOT EXISTS (
        SELECT 1 FROM sec.role_permissions rp2 
        WHERE rp2.role_id = r.role_id 
          AND rp2.permission_id = p.permission_id
      );
  `);

  console.log("Permiso 'reports.view' asignado al rol admin");

  // Verificar resultado
  const result = await pool.request().query(`
    SELECT p.permission_key 
    FROM sec.role_permissions rp
    JOIN sec.permissions p ON p.permission_id = rp.permission_id
    JOIN sec.roles r ON r.role_id = rp.role_id
    WHERE r.role_name = 'admin'
    ORDER BY p.permission_key;
  `);

  console.log("\nPermisos del rol admin:");
  result.recordset.forEach((row) => console.log(`  - ${row.permission_key}`));
}

main()
  .then(() => {
    console.log("\n✓ Proceso completado");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Error:", err.message);
    process.exit(1);
  });