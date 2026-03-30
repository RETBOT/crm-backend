USE crm_core;
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.columns 
  WHERE object_id = OBJECT_ID('crm.products') AND name = 'updated_at'
)
BEGIN
  ALTER TABLE crm.products 
  ADD updated_at datetime2(0) NOT NULL 
  CONSTRAINT DF_products_updated DEFAULT SYSUTCDATETIME();
  
  PRINT 'Columna updated_at agregada a crm.products';
END
ELSE
BEGIN
  PRINT 'La columna updated_at ya existe en crm.products';
END
GO