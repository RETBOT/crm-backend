USE crm_core;
GO

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'sec' AND TABLE_NAME = 'user_email_accounts')
BEGIN
    CREATE TABLE sec.user_email_accounts (
        id INT IDENTITY(1,1) PRIMARY KEY,
        user_id INT NOT NULL,
        provider VARCHAR(20) NOT NULL CHECK (provider IN ('google', 'microsoft')),
        email VARCHAR(255) NOT NULL,
        access_token NVARCHAR(MAX) NOT NULL,
        refresh_token NVARCHAR(MAX) NULL,
        token_expires_at DATETIME2 NULL,
        is_default BIT NOT NULL DEFAULT 0,
        is_active BIT NOT NULL DEFAULT 1,
        connected_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        last_used_at DATETIME2 NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_user_email_accounts_user FOREIGN KEY (user_id) REFERENCES sec.users(user_id) ON DELETE CASCADE,
        CONSTRAINT UQ_user_email_provider UNIQUE (user_id, provider)
    );
    PRINT 'Tabla sec.user_email_accounts creada';
END
ELSE
BEGIN
    PRINT 'La tabla sec.user_email_accounts ya existe';
END
GO

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'crm' AND TABLE_NAME = 'email_sent')
BEGIN
    CREATE TABLE crm.email_sent (
        id INT IDENTITY(1,1) PRIMARY KEY,
        user_id INT NOT NULL,
        company_id INT NOT NULL,
        customer_id INT NULL,
        email_account_id INT NULL,
        provider VARCHAR(20) NOT NULL,
        [to] NVARCHAR(500) NOT NULL,
        cc NVARCHAR(500) NULL,
        bcc NVARCHAR(500) NULL,
        subject NVARCHAR(500) NOT NULL,
        body NVARCHAR(MAX) NOT NULL,
        has_attachments BIT NOT NULL DEFAULT 0,
        provider_message_id NVARCHAR(500) NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'draft')),
        sent_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_email_sent_user FOREIGN KEY (user_id) REFERENCES sec.users(user_id),
        CONSTRAINT FK_email_sent_company FOREIGN KEY (company_id) REFERENCES sec.companies(company_id),
        CONSTRAINT FK_email_sent_customer FOREIGN KEY (customer_id) REFERENCES crm.customers(customer_id),
        CONSTRAINT FK_email_sent_account FOREIGN KEY (email_account_id) REFERENCES sec.user_email_accounts(id)
    );
    PRINT 'Tabla crm.email_sent creada';
END
ELSE
BEGIN
    PRINT 'La tabla crm.email_sent ya existe';
END
GO
