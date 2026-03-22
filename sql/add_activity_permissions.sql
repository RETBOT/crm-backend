USE crm_core;
GO

-- ============================================================
-- Migracion: Agregar permisos de actividades
-- Ejecutar UNA VEZ en BD existente
-- ============================================================

DECLARE @company_id INT = (SELECT TOP 1 company_id FROM sec.companies ORDER BY company_id);

-- 1) Insertar permisos faltantes en sec.permissions
INSERT INTO sec.permissions (permission_key, permission_description)
SELECT 'activities.create', N'Crear actividades'
WHERE NOT EXISTS (SELECT 1 FROM sec.permissions WHERE permission_key = 'activities.create');

INSERT INTO sec.permissions (permission_key, permission_description)
SELECT 'activities.update', N'Actualizar actividades'
WHERE NOT EXISTS (SELECT 1 FROM sec.permissions WHERE permission_key = 'activities.update');

INSERT INTO sec.permissions (permission_key, permission_description)
SELECT 'activities.complete', N'Completar/cancelar actividades'
WHERE NOT EXISTS (SELECT 1 FROM sec.permissions WHERE permission_key = 'activities.complete');

-- 2) Asignar los 3 permisos al rol 'admin'
DECLARE @role_admin INT = (
  SELECT role_id FROM sec.roles WHERE company_id = @company_id AND role_name = 'admin'
);

IF @role_admin IS NOT NULL
BEGIN
  INSERT INTO sec.role_permissions (role_id, permission_id)
  SELECT @role_admin, p.permission_id
  FROM sec.permissions p
  WHERE p.permission_key IN ('activities.create', 'activities.update', 'activities.complete')
    AND NOT EXISTS (
      SELECT 1 FROM sec.role_permissions rp
      WHERE rp.role_id = @role_admin AND rp.permission_id = p.permission_id
    );
END

-- 3) Verificar resultado
SELECT p.permission_key, p.permission_description
FROM sec.permissions p
WHERE p.permission_key LIKE 'activities.%';

SELECT r.role_name, p.permission_key
FROM sec.role_permissions rp
INNER JOIN sec.roles r ON r.role_id = rp.role_id
INNER JOIN sec.permissions p ON p.permission_id = rp.permission_id
WHERE p.permission_key LIKE 'activities.%';
GO
