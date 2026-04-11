USE crm_core;
GO

PRINT '=== Migration: add_vendedor_code_if_missing ===';
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('crm.vendedores') AND name = 'vendedor_code')
BEGIN
    ALTER TABLE crm.vendedores ADD vendedor_code varchar(20) NOT NULL DEFAULT 'V-000';
    PRINT 'OK: Column vendedor_code added to crm.vendedores';
END
ELSE
BEGIN
    PRINT 'OK: Column vendedor_code already exists';
END
GO

PRINT '=== Migration completed ===';
GO
