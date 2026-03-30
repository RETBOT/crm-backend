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

INSERT INTO sec.permissions (permission_key, permission_description)
SELECT 'activities.create', N'Crear actividades'
WHERE NOT EXISTS (SELECT 1 FROM sec.permissions WHERE permission_key = 'activities.create');

INSERT INTO sec.permissions (permission_key, permission_description)
SELECT 'activities.update', N'Actualizar actividades'
WHERE NOT EXISTS (SELECT 1 FROM sec.permissions WHERE permission_key = 'activities.update');

INSERT INTO sec.permissions (permission_key, permission_description)
SELECT 'activities.complete', N'Completar/cancelar actividades'
WHERE NOT EXISTS (SELECT 1 FROM sec.permissions WHERE permission_key = 'activities.complete');

INSERT INTO sec.permissions (permission_key, permission_description)
SELECT 'activities.assign', N'Asignar actividades a otros usuarios'
WHERE NOT EXISTS (SELECT 1 FROM sec.permissions WHERE permission_key = 'activities.assign');

INSERT INTO sec.permissions (permission_key, permission_description)
SELECT 'products.create', N'Crear productos'
WHERE NOT EXISTS (SELECT 1 FROM sec.permissions WHERE permission_key = 'products.create');

INSERT INTO sec.permissions (permission_key, permission_description)
SELECT 'products.update', N'Actualizar productos'
WHERE NOT EXISTS (SELECT 1 FROM sec.permissions WHERE permission_key = 'products.update');

INSERT INTO sec.permissions (permission_key, permission_description)
SELECT 'products.delete', N'Eliminar productos'
WHERE NOT EXISTS (SELECT 1 FROM sec.permissions WHERE permission_key = 'products.delete');

INSERT INTO sec.permissions (permission_key, permission_description)
SELECT 'products.price.edit', N'Editar precios de productos'
WHERE NOT EXISTS (SELECT 1 FROM sec.permissions WHERE permission_key = 'products.price.edit');

INSERT INTO sec.permissions (permission_key, permission_description)
SELECT 'opportunities.create', N'Crear oportunidades'
WHERE NOT EXISTS (SELECT 1 FROM sec.permissions WHERE permission_key = 'opportunities.create');

INSERT INTO sec.permissions (permission_key, permission_description)
SELECT 'opportunities.update', N'Actualizar oportunidades'
WHERE NOT EXISTS (SELECT 1 FROM sec.permissions WHERE permission_key = 'opportunities.update');

INSERT INTO sec.permissions (permission_key, permission_description)
SELECT 'opportunities.delete', N'Eliminar oportunidades'
WHERE NOT EXISTS (SELECT 1 FROM sec.permissions WHERE permission_key = 'opportunities.delete');

INSERT INTO sec.permissions (permission_key, permission_description)
SELECT 'opportunities.price.edit', N'Editar precios de oportunidades'
WHERE NOT EXISTS (SELECT 1 FROM sec.permissions WHERE permission_key = 'opportunities.price.edit');

INSERT INTO sec.permissions (permission_key, permission_description)
SELECT 'opportunities.items.create', N'Crear ítems de oportunidades'
WHERE NOT EXISTS (SELECT 1 FROM sec.permissions WHERE permission_key = 'opportunities.items.create');

INSERT INTO sec.permissions (permission_key, permission_description)
SELECT 'opportunities.items.update', N'Actualizar ítems de oportunidades'
WHERE NOT EXISTS (SELECT 1 FROM sec.permissions WHERE permission_key = 'opportunities.items.update');

INSERT INTO sec.permissions (permission_key, permission_description)
SELECT 'opportunities.items.delete', N'Eliminar ítems de oportunidades'
WHERE NOT EXISTS (SELECT 1 FROM sec.permissions WHERE permission_key = 'opportunities.items.delete');

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
  'prospects.create', 'prospects.update', 'prospects.delete', 'prospects.convert',
  'activities.create', 'activities.update', 'activities.complete', 'activities.assign',
  'products.create', 'products.update', 'products.delete', 'products.price.edit',
  'opportunities.create', 'opportunities.update', 'opportunities.delete',
  'opportunities.price.edit', 'opportunities.items.create', 'opportunities.items.update', 'opportunities.items.delete'
)
AND NOT EXISTS (
  SELECT 1 FROM sec.role_permissions rp WHERE rp.role_id = @role_admin AND rp.permission_id = p.permission_id
);

INSERT INTO sec.role_permissions (role_id, permission_id)
SELECT @role_ventas, p.permission_id
FROM sec.permissions p
WHERE p.permission_key IN (
  'customers.create', 'customers.update', 'prospects.create', 'prospects.update',
  'products.create', 'products.update', 'products.price.edit',
  'opportunities.create', 'opportunities.update', 'opportunities.delete',
  'opportunities.price.edit', 'opportunities.items.create', 'opportunities.items.update', 'opportunities.items.delete'
)
AND NOT EXISTS (
  SELECT 1 FROM sec.role_permissions rp WHERE rp.role_id = @role_ventas AND rp.permission_id = p.permission_id
);

INSERT INTO sec.role_permissions (role_id, permission_id)
SELECT @role_supervisor, p.permission_id
FROM sec.permissions p
WHERE p.permission_key IN (
  'customers.create', 'customers.update',
  'prospects.create', 'prospects.update', 'prospects.convert',
  'products.create', 'products.update', 'products.delete', 'products.price.edit',
  'opportunities.create', 'opportunities.update', 'opportunities.delete',
  'opportunities.price.edit', 'opportunities.items.create', 'opportunities.items.update', 'opportunities.items.delete'
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
