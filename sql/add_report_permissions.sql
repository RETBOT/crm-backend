-- Agregar permisos de reportes si no existen
-- Ejecutar despues de desplegar el codigo de reportes

INSERT INTO sec.permissions (permission_key, permission_description)
SELECT 'reports.export', N'Exportar reportes a Excel/CSV'
WHERE NOT EXISTS (SELECT 1 FROM sec.permissions WHERE permission_key = 'reports.export');

INSERT INTO sec.permissions (permission_key, permission_description)
SELECT 'reports.scheduled', N'Programar reportes por email'
WHERE NOT EXISTS (SELECT 1 FROM sec.permissions WHERE permission_key = 'reports.scheduled');

INSERT INTO sec.permissions (permission_key, permission_description)
SELECT 'reports.saved_views', N'Guardar vistas de reportes'
WHERE NOT EXISTS (SELECT 1 FROM sec.permissions WHERE permission_key = 'reports.saved_views');

-- Asignar permisos de reportes al rol admin
INSERT INTO sec.role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM sec.roles r
CROSS JOIN sec.permissions p
WHERE r.role_name = 'admin'
  AND p.permission_key IN ('reports.export', 'reports.scheduled', 'reports.saved_views')
  AND NOT EXISTS (
    SELECT 1 FROM sec.role_permissions rp
    WHERE rp.role_id = r.role_id AND rp.permission_id = p.permission_id
  );

-- Asignar permisos de reportes al rol supervisor
INSERT INTO sec.role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM sec.roles r
CROSS JOIN sec.permissions p
WHERE r.role_name = 'supervisor'
  AND p.permission_key IN ('reports.export', 'reports.scheduled', 'reports.saved_views')
  AND NOT EXISTS (
    SELECT 1 FROM sec.role_permissions rp
    WHERE rp.role_id = r.role_id AND rp.permission_id = p.permission_id
  );

-- Verificar permisos asignados
SELECT r.role_name, p.permission_key, p.permission_description
FROM sec.role_permissions rp
INNER JOIN sec.roles r ON r.role_id = rp.role_id
INNER JOIN sec.permissions p ON p.permission_id = rp.permission_id
WHERE p.permission_key LIKE 'reports.%'
ORDER BY r.role_name, p.permission_key;
