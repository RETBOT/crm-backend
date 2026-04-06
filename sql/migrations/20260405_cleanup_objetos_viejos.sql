USE crm_core;
GO

PRINT '=== Cleanup: eliminar objetos con nombres viejos (route/ruta) ===';
GO

-- Tabla crm.routes
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'routes' AND schema_id = SCHEMA_ID('crm'))
BEGIN
    DROP TABLE crm.routes;
    PRINT 'OK: Eliminada tabla crm.routes';
END
ELSE
BEGIN
    PRINT 'OK: tabla crm.routes no existe';
END
GO

-- Tabla sec.user_route_access
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'user_route_access' AND schema_id = SCHEMA_ID('sec'))
BEGIN
    DROP TABLE sec.user_route_access;
    PRINT 'OK: Eliminada tabla sec.user_route_access';
END
ELSE
BEGIN
    PRINT 'OK: tabla sec.user_route_access no existe';
END
GO

-- Vista api.vw_cn_rutas
IF EXISTS (SELECT 1 FROM sys.views WHERE name = 'vw_cn_rutas')
BEGIN
    DROP VIEW api.vw_cn_rutas;
    PRINT 'OK: Eliminada vista api.vw_cn_rutas';
END
ELSE
BEGIN
    PRINT 'OK: vista api.vw_cn_rutas no existe';
END
GO

-- Verificar objetos actuales
PRINT '';
PRINT '=== Verificacion de objetos actuales ===';
GO

PRINT 'Tablas en schema crm:';
SELECT name FROM sys.tables WHERE schema_id = SCHEMA_ID('crm') ORDER BY name;
GO

PRINT 'Tablas en schema sec:';
SELECT name FROM sys.tables WHERE schema_id = SCHEMA_ID('sec') ORDER BY name;
GO

PRINT 'Vistas en schema api:';
SELECT name FROM sys.views WHERE schema_id = SCHEMA_ID('api') ORDER BY name;
GO

PRINT '=== Cleanup completado ===';
GO
