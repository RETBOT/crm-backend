USE crm_core;
GO

PRINT '=== Migration: rename user_route_access to user_vendedor_access ===';
GO

-- Rename table
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'user_route_access' AND schema_id = SCHEMA_ID('sec'))
BEGIN
    EXEC sp_rename 'sec.user_route_access', 'user_vendedor_access';
    PRINT 'OK: Table renamed sec.user_route_access -> sec.user_vendedor_access';
END
ELSE IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'user_vendedor_access' AND schema_id = SCHEMA_ID('sec'))
BEGIN
    PRINT 'OK: Table sec.user_vendedor_access already exists';
END
GO

-- Rename column route_id -> vendedor_id
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('sec.user_vendedor_access') AND name = 'route_id')
BEGIN
    EXEC sp_rename 'sec.user_vendedor_access.route_id', 'vendedor_id', 'COLUMN';
    PRINT 'OK: Column renamed route_id -> vendedor_id';
END
ELSE IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('sec.user_vendedor_access') AND name = 'vendedor_id')
BEGIN
    PRINT 'OK: Column vendedor_id already exists';
END
GO

-- Rename primary key
IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'PK_user_route_access')
BEGIN
    EXEC sp_rename 'sec.PK_user_route_access', 'PK_user_vendedor_access';
    PRINT 'OK: PK renamed';
END
ELSE IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'PK_user_vendedor_access')
BEGIN
    PRINT 'OK: PK user_vendedor_access already exists';
END
GO

-- Rename FK
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_user_route_access_route')
BEGIN
    EXEC sp_rename 'sec.FK_user_route_access_route', 'FK_user_vendedor_access_vendedor';
    PRINT 'OK: FK renamed';
END
ELSE IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_user_vendedor_access_vendedor')
BEGIN
    PRINT 'OK: FK user_vendedor_access_vendedor already exists';
END
GO

-- Rename FK user
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_user_route_access_user')
BEGIN
    EXEC sp_rename 'sec.FK_user_route_access_user', 'FK_user_vendedor_access_user';
    PRINT 'OK: FK user renamed';
END
ELSE IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_user_vendedor_access_user')
BEGIN
    PRINT 'OK: FK user already exists';
END
GO

-- Rename default constraint
IF EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'DF_user_route_access_created_at')
BEGIN
    EXEC sp_rename 'sec.DF_user_route_access_created_at', 'DF_user_vendedor_access_created_at';
    PRINT 'OK: Default constraint renamed';
END
ELSE IF EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'DF_user_vendedor_access_created_at')
BEGIN
    PRINT 'OK: Default constraint user_vendedor_access already exists';
END
GO

-- Rename index
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_user_route_access_lookup')
BEGIN
    EXEC sp_rename 'sec.IX_user_route_access_lookup', 'IX_user_vendedor_access_lookup';
    PRINT 'OK: Index renamed';
END
ELSE IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_user_vendedor_access_lookup')
BEGIN
    PRINT 'OK: Index IX_user_vendedor_access_lookup already exists';
END
GO

PRINT '=== Migration completed ===';
GO
