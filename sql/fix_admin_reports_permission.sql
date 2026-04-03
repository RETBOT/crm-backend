-- Agregar permiso reports.view al rol admin
USE crm_core;
GO

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

-- Verificar resultado
SELECT p.permission_key 
FROM sec.role_permissions rp
JOIN sec.permissions p ON p.permission_id = rp.permission_id
JOIN sec.roles r ON r.role_id = rp.role_id
WHERE r.role_name = 'admin'
ORDER BY p.permission_key;