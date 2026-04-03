-- Agregar permisos de lectura para clientes y prospectos
-- Ejecutar después de desplegar el código nuevo

-- 1. Insertar los nuevos permisos en sec.permissions (si no existen)
INSERT INTO sec.permissions (permission_key, description)
SELECT 'customers.read', 'Ver lista de clientes'
WHERE NOT EXISTS (SELECT 1 FROM sec.permissions WHERE permission_key = 'customers.read');

INSERT INTO sec.permissions (permission_key, description)
SELECT 'prospects.read', 'Ver lista de prospectos'
WHERE NOT EXISTS (SELECT 1 FROM sec.permissions WHERE permission_key = 'prospects.read');

-- 2. Asignar estos permisos a TODOS los roles que ya tienen customers.create
-- (asumimos que si puede crear, también debe poder ver)
INSERT INTO sec.role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM sec.roles r
CROSS JOIN sec.permissions p
WHERE p.permission_key IN ('customers.read', 'prospects.read')
  AND NOT EXISTS (
    SELECT 1 FROM sec.role_permissions rp
    WHERE rp.role_id = r.role_id AND rp.permission_id = p.permission_id
  )
  AND EXISTS (
    SELECT 1 FROM sec.role_permissions rp2
    INNER JOIN sec.permissions p2 ON p2.permission_id = rp2.permission_id
    WHERE rp2.role_id = r.role_id
      AND p2.permission_key IN ('customers.create', 'prospects.create', 'customers.update', 'prospects.update')
  );

-- 3. Verificar
SELECT r.role_name, p.permission_key
FROM sec.roles r
INNER JOIN sec.role_permissions rp ON rp.role_id = r.role_id
INNER JOIN sec.permissions p ON p.permission_id = rp.permission_id
WHERE p.permission_key IN ('customers.read', 'prospects.read', 'customers.create', 'customers.update', 'customers.delete')
ORDER BY r.role_name, p.permission_key;
