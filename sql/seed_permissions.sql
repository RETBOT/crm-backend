USE crm_core;
GO

DECLARE @company_id INT = (SELECT TOP 1 company_id FROM sec.companies ORDER BY company_id);
DECLARE @admin_user_id INT = (
  SELECT TOP 1 user_id
  FROM sec.users
  WHERE company_id = @company_id
    AND username = 'admin'
);

INSERT INTO sec.permissions (permission_key, permission_description)
SELECT 'users.manage', N'Administrar usuarios'
WHERE NOT EXISTS (SELECT 1 FROM sec.permissions WHERE permission_key = 'users.manage');

INSERT INTO sec.permissions (permission_key, permission_description)
SELECT 'roles.manage', N'Administrar roles'
WHERE NOT EXISTS (SELECT 1 FROM sec.permissions WHERE permission_key = 'roles.manage');

INSERT INTO sec.permissions (permission_key, permission_description)
SELECT 'scope.manage', N'Administrar alcance de datos'
WHERE NOT EXISTS (SELECT 1 FROM sec.permissions WHERE permission_key = 'scope.manage');

INSERT INTO sec.permissions (permission_key, permission_description)
SELECT 'customers.create', N'Crear clientes'
WHERE NOT EXISTS (SELECT 1 FROM sec.permissions WHERE permission_key = 'customers.create');

INSERT INTO sec.permissions (permission_key, permission_description)
SELECT 'customers.update', N'Actualizar clientes'
WHERE NOT EXISTS (SELECT 1 FROM sec.permissions WHERE permission_key = 'customers.update');

INSERT INTO sec.permissions (permission_key, permission_description)
SELECT 'customers.delete', N'Inactivar clientes'
WHERE NOT EXISTS (SELECT 1 FROM sec.permissions WHERE permission_key = 'customers.delete');

INSERT INTO sec.permissions (permission_key, permission_description)
SELECT 'prospects.create', N'Crear prospectos'
WHERE NOT EXISTS (SELECT 1 FROM sec.permissions WHERE permission_key = 'prospects.create');

INSERT INTO sec.permissions (permission_key, permission_description)
SELECT 'prospects.update', N'Actualizar prospectos'
WHERE NOT EXISTS (SELECT 1 FROM sec.permissions WHERE permission_key = 'prospects.update');

INSERT INTO sec.permissions (permission_key, permission_description)
SELECT 'prospects.delete', N'Inactivar prospectos'
WHERE NOT EXISTS (SELECT 1 FROM sec.permissions WHERE permission_key = 'prospects.delete');

INSERT INTO sec.permissions (permission_key, permission_description)
SELECT 'prospects.convert', N'Convertir prospectos a cliente'
WHERE NOT EXISTS (SELECT 1 FROM sec.permissions WHERE permission_key = 'prospects.convert');

INSERT INTO sec.roles (company_id, role_name, role_description, is_active)
SELECT @company_id, 'admin', N'Administrador general', 1
WHERE NOT EXISTS (
  SELECT 1 FROM sec.roles WHERE company_id = @company_id AND role_name = 'admin'
);

INSERT INTO sec.roles (company_id, role_name, role_description, is_active)
SELECT @company_id, 'ventas', N'Ejecutivo de ventas', 1
WHERE NOT EXISTS (
  SELECT 1 FROM sec.roles WHERE company_id = @company_id AND role_name = 'ventas'
);

INSERT INTO sec.roles (company_id, role_name, role_description, is_active)
SELECT @company_id, 'supervisor', N'Supervisor comercial', 1
WHERE NOT EXISTS (
  SELECT 1 FROM sec.roles WHERE company_id = @company_id AND role_name = 'supervisor'
);

DECLARE @role_admin INT = (
  SELECT role_id FROM sec.roles WHERE company_id = @company_id AND role_name = 'admin'
);
DECLARE @role_ventas INT = (
  SELECT role_id FROM sec.roles WHERE company_id = @company_id AND role_name = 'ventas'
);
DECLARE @role_supervisor INT = (
  SELECT role_id FROM sec.roles WHERE company_id = @company_id AND role_name = 'supervisor'
);

INSERT INTO sec.role_permissions (role_id, permission_id)
SELECT @role_admin, p.permission_id
FROM sec.permissions p
WHERE p.permission_key IN (
  'users.manage', 'roles.manage', 'scope.manage',
  'customers.create', 'customers.update', 'customers.delete',
  'prospects.create', 'prospects.update', 'prospects.delete', 'prospects.convert'
)
AND NOT EXISTS (
  SELECT 1 FROM sec.role_permissions rp WHERE rp.role_id = @role_admin AND rp.permission_id = p.permission_id
);

INSERT INTO sec.role_permissions (role_id, permission_id)
SELECT @role_ventas, p.permission_id
FROM sec.permissions p
WHERE p.permission_key IN ('customers.create', 'customers.update', 'prospects.create', 'prospects.update')
AND NOT EXISTS (
  SELECT 1 FROM sec.role_permissions rp WHERE rp.role_id = @role_ventas AND rp.permission_id = p.permission_id
);

INSERT INTO sec.role_permissions (role_id, permission_id)
SELECT @role_supervisor, p.permission_id
FROM sec.permissions p
WHERE p.permission_key IN (
  'customers.create', 'customers.update',
  'prospects.create', 'prospects.update', 'prospects.convert'
)
AND NOT EXISTS (
  SELECT 1 FROM sec.role_permissions rp WHERE rp.role_id = @role_supervisor AND rp.permission_id = p.permission_id
);

IF @admin_user_id IS NOT NULL
BEGIN
  INSERT INTO sec.user_roles (user_id, role_id)
  SELECT @admin_user_id, @role_admin
  WHERE NOT EXISTS (
    SELECT 1 FROM sec.user_roles ur WHERE ur.user_id = @admin_user_id AND ur.role_id = @role_admin
  );
END
GO
