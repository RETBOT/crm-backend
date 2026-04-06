USE crm_core;
GO

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'crm' AND TABLE_NAME = 'calendar_sync')
BEGIN
    CREATE TABLE crm.calendar_sync (
        id INT IDENTITY(1,1) PRIMARY KEY,
        user_id INT NOT NULL,
        provider VARCHAR(20) NOT NULL CHECK (provider IN ('google', 'microsoft')),
        calendar_id VARCHAR(255) NOT NULL DEFAULT 'primary',
        sync_token NVARCHAR(MAX) NULL,
        page_token NVARCHAR(MAX) NULL,
        last_sync DATETIME2 NULL,
        enabled BIT NOT NULL DEFAULT 1,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_calendar_sync_user FOREIGN KEY (user_id) REFERENCES sec.users(user_id) ON DELETE CASCADE,
        CONSTRAINT UQ_calendar_sync_user_provider UNIQUE (user_id, provider)
    );
    PRINT 'Tabla crm.calendar_sync creada';
END
ELSE
BEGIN
    PRINT 'La tabla crm.calendar_sync ya existe';
END
GO

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'crm' AND TABLE_NAME = 'external_events')
BEGIN
    CREATE TABLE crm.external_events (
        id INT IDENTITY(1,1) PRIMARY KEY,
        user_id INT NOT NULL,
        provider VARCHAR(20) NOT NULL CHECK (provider IN ('google', 'microsoft')),
        external_id NVARCHAR(500) NOT NULL,
        title NVARCHAR(500) NOT NULL,
        description NVARCHAR(MAX) NULL,
        start_time DATETIME2 NOT NULL,
        end_time DATETIME2 NOT NULL,
        location NVARCHAR(500) NULL,
        is_all_day BIT NOT NULL DEFAULT 0,
        linked_activity_id INT NULL,
        synced_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_external_events_user FOREIGN KEY (user_id) REFERENCES sec.users(user_id) ON DELETE CASCADE,
        CONSTRAINT UQ_external_events_provider_ext UNIQUE (user_id, provider, external_id)
    );
    PRINT 'Tabla crm.external_events creada';
END
ELSE
BEGIN
    PRINT 'La tabla crm.external_events ya existe';
END
GO
