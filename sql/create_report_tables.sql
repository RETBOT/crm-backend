-- ============================================
-- SCRIPT PARA CREAR TABLAS DE REPORTES
-- Ejecutar en la base de datos crm_core
-- ============================================

USE crm_core;
GO

-- ============================================
-- TABLA: Vistas guardadas de reportes
-- ============================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'report_saved_views' AND schema_id = SCHEMA_ID('crm'))
BEGIN
  CREATE TABLE crm.report_saved_views (
    view_id INT IDENTITY(1,1) PRIMARY KEY,
    company_id INT NOT NULL,
    user_id INT NOT NULL,
    report_type VARCHAR(50) NOT NULL,
    view_name VARCHAR(100) NOT NULL,
    filters NVARCHAR(MAX) NOT NULL, -- JSON con los filtros
    is_default BIT DEFAULT 0,
    created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2 DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_report_saved_views_company FOREIGN KEY (company_id) REFERENCES sec.companies(company_id),
    CONSTRAINT FK_report_saved_views_user FOREIGN KEY (user_id) REFERENCES sec.users(user_id)
  );
  
  CREATE INDEX IX_report_saved_views_user ON crm.report_saved_views(company_id, user_id);
  CREATE INDEX IX_report_saved_views_type ON crm.report_saved_views(company_id, report_type);
  
  PRINT 'Tabla crm.report_saved_views creada correctamente';
END
ELSE
BEGIN
  PRINT 'La tabla crm.report_saved_views ya existe';
END
GO

-- ============================================
-- TABLA: Reportes programados
-- ============================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'report_scheduled' AND schema_id = SCHEMA_ID('crm'))
BEGIN
  CREATE TABLE crm.report_scheduled (
    schedule_id INT IDENTITY(1,1) PRIMARY KEY,
    company_id INT NOT NULL,
    user_id INT NOT NULL,
    report_type VARCHAR(50) NOT NULL,
    frequency VARCHAR(20) NOT NULL, -- daily, weekly, monthly
    day_of_week TINYINT NULL, -- 0=Sunday, 6=Saturday (para weekly)
    day_of_month TINYINT NULL, -- 1-31 (para monthly)
    recipients NVARCHAR(MAX) NOT NULL, -- JSON array de emails
    filters NVARCHAR(MAX) NOT NULL, -- JSON con los filtros
    next_run_at DATETIME2 NOT NULL,
    last_run_at DATETIME2 NULL,
    is_active BIT DEFAULT 1,
    created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2 DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_report_scheduled_company FOREIGN KEY (company_id) REFERENCES sec.companies(company_id),
    CONSTRAINT FK_report_scheduled_user FOREIGN KEY (user_id) REFERENCES sec.users(user_id)
  );
  
  CREATE INDEX IX_report_scheduled_next_run ON crm.report_scheduled(company_id, next_run_at, is_active);
  CREATE INDEX IX_report_scheduled_user ON crm.report_scheduled(company_id, user_id);
  
  PRINT 'Tabla crm.report_scheduled creada correctamente';
END
ELSE
BEGIN
  PRINT 'La tabla crm.report_scheduled ya existe';
END
GO

-- ============================================
-- TABLA: Log de reportes generados (opcional, para auditoría)
-- ============================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'report_logs' AND schema_id = SCHEMA_ID('crm'))
BEGIN
  CREATE TABLE crm.report_logs (
    log_id INT IDENTITY(1,1) PRIMARY KEY,
    company_id INT NOT NULL,
    user_id INT NOT NULL,
    report_type VARCHAR(50) NOT NULL,
    filters NVARCHAR(MAX) NULL, -- JSON con los filtros usados
    export_format VARCHAR(20) NULL, -- excel, pdf, null si solo se visualizó
    execution_time_ms INT NULL, -- Tiempo de ejecución en milisegundos
    row_count INT NULL, -- Número de filas retornadas
    status VARCHAR(20) NOT NULL DEFAULT 'success', -- success, error
    error_message NVARCHAR(MAX) NULL,
    created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_report_logs_company FOREIGN KEY (company_id) REFERENCES sec.companies(company_id),
    CONSTRAINT FK_report_logs_user FOREIGN KEY (user_id) REFERENCES sec.users(user_id)
  );
  
  CREATE INDEX IX_report_logs_user ON crm.report_logs(company_id, user_id, created_at);
  CREATE INDEX IX_report_logs_type ON crm.report_logs(company_id, report_type, created_at);
  
  PRINT 'Tabla crm.report_logs creada correctamente';
END
ELSE
BEGIN
  PRINT 'La tabla crm.report_logs ya existe';
END
GO

PRINT '============================================';
PRINT 'Scripts de creación de tablas de reportes ejecutados';
PRINT '============================================';