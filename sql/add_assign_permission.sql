USE crm_core;
GO

-- Permiso activities.assign
INSERT INTO sec.permissions (permission_key, permission_description)
SELECT 'activities.assign', N'Asignar actividades a otros usuarios'
WHERE NOT EXISTS (SELECT 1 FROM sec.permissions WHERE permission_key = 'activities.assign');

-- Asignar al rol admin
DECLARE @role_admin INT = (SELECT TOP 1 role_id FROM sec.roles WHERE role_name = 'admin');
DECLARE @perm_id INT = (SELECT permission_id FROM sec.permissions WHERE permission_key = 'activities.assign');

IF @role_admin IS NOT NULL AND @perm_id IS NOT NULL
BEGIN
  INSERT INTO sec.role_permissions (role_id, permission_id)
  SELECT @role_admin, @perm_id
  WHERE NOT EXISTS (
    SELECT 1 FROM sec.role_permissions WHERE role_id = @role_admin AND permission_id = @perm_id
  );
END

-- Verificar
SELECT p.permission_key, p.permission_description
FROM sec.permissions p
WHERE p.permission_key = 'activities.assign';
GO
