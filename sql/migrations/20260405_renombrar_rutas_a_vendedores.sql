USE crm_core;
GO

PRINT '=== Migration: rename routes to vendedores ===';
GO

-- 1. Table
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'routes' AND schema_id = SCHEMA_ID('crm'))
BEGIN
    EXEC sp_rename 'crm.routes', 'vendedores';
    PRINT 'OK: Table renamed crm.routes -> crm.vendedores';
END
ELSE
BEGIN
    PRINT 'OK: Table crm.vendedores already exists';
END
GO

-- 2. Column route_id
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('crm.vendedores') AND name = 'route_id')
BEGIN
    EXEC sp_rename 'crm.vendedores.route_id', 'vendedor_id', 'COLUMN';
    PRINT 'OK: Column renamed route_id -> vendedor_id';
END
ELSE
BEGIN
    PRINT 'OK: Column vendedor_id already exists';
END
GO

-- 3. Column route_name
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('crm.vendedores') AND name = 'route_name')
BEGIN
    EXEC sp_rename 'crm.vendedores.route_name', 'vendedor_name', 'COLUMN';
    PRINT 'OK: Column renamed route_name -> vendedor_name';
END
ELSE
BEGIN
    PRINT 'OK: Column vendedor_name already exists';
END
GO

-- 4. Constraint
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_routes_status')
BEGIN
    EXEC sp_rename 'crm.CK_routes_status', 'CK_vendedores_status';
    PRINT 'OK: Constraint renamed';
END
ELSE
BEGIN
    PRINT 'OK: Constraint CK_vendedores_status already exists';
END
GO

-- 5. Index
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_routes_company_branch')
BEGIN
    EXEC sp_rename 'crm.IX_routes_company_branch', 'IX_vendedores_company_branch';
    PRINT 'OK: Index renamed';
END
ELSE
BEGIN
    PRINT 'OK: Index IX_vendedores_company_branch already exists';
END
GO

-- 6. Foreign Key
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_customers_route')
BEGIN
    EXEC sp_rename 'FK_customers_route', 'FK_customers_vendedor';
    PRINT 'OK: FK renamed';
END
ELSE
BEGIN
    PRINT 'OK: FK FK_customers_vendedor already exists';
END
GO

-- 7. View (old name)
IF EXISTS (SELECT 1 FROM sys.views WHERE name = 'vw_cn_rutas')
BEGIN
    EXEC sp_rename 'api.vw_cn_rutas', 'vw_cn_vendedores';
    PRINT 'OK: View renamed';
END
ELSE
BEGIN
    PRINT 'OK: View vw_cn_rutas not found or already renamed';
END
GO

-- 8. Create view if not exists
IF NOT EXISTS (SELECT 1 FROM sys.views WHERE name = 'vw_cn_vendedores')
BEGIN
    EXEC('
    CREATE VIEW api.vw_cn_vendedores
    AS
    SELECT
        v.vendedor_id AS ID,
        v.vendedor_name AS DSC,
        v.branch_id AS SUCURSALID
    FROM crm.vendedores v
    WHERE v.status = ''ACTIVO''
    ');
    PRINT 'OK: View api.vw_cn_vendedores created';
END
ELSE
BEGIN
    PRINT 'OK: View api.vw_cn_vendedores already exists';
END
GO

PRINT '=== Migration completed ===';
GO
