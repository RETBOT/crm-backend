USE crm_core;
GO

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'crm' AND TABLE_NAME = 'email_templates')
BEGIN
    CREATE TABLE crm.email_templates (
        id INT IDENTITY(1,1) PRIMARY KEY,
        user_id INT NULL,
        company_id INT NOT NULL,
        name NVARCHAR(255) NOT NULL,
        subject NVARCHAR(500) NOT NULL,
        body NVARCHAR(MAX) NOT NULL,
        variables NVARCHAR(1000) NULL,
        is_system BIT NOT NULL DEFAULT 0,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_email_templates_user FOREIGN KEY (user_id) REFERENCES sec.users(user_id) ON DELETE SET NULL,
        CONSTRAINT FK_email_templates_company FOREIGN KEY (company_id) REFERENCES sec.companies(company_id)
    );
    PRINT 'Tabla crm.email_templates creada';
END
ELSE
BEGIN
    PRINT 'La tabla crm.email_templates ya existe';
END
GO

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'crm' AND TABLE_NAME = 'email_tracking')
BEGIN
    CREATE TABLE crm.email_tracking (
        id INT IDENTITY(1,1) PRIMARY KEY,
        email_sent_id INT NOT NULL,
        opened BIT NOT NULL DEFAULT 0,
        opened_at DATETIME2 NULL,
        open_count INT NOT NULL DEFAULT 0,
        links_clicked NVARCHAR(MAX) NULL,
        last_clicked_at DATETIME2 NULL,
        bounce_status VARCHAR(20) NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_email_tracking_sent FOREIGN KEY (email_sent_id) REFERENCES crm.email_sent(id) ON DELETE CASCADE
    );
    PRINT 'Tabla crm.email_tracking creada';
END
ELSE
BEGIN
    PRINT 'La tabla crm.email_tracking ya existe';
END
GO

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'sec' AND TABLE_NAME = 'user_signatures')
BEGIN
    CREATE TABLE sec.user_signatures (
        id INT IDENTITY(1,1) PRIMARY KEY,
        user_id INT NOT NULL,
        signature_html NVARCHAR(MAX) NOT NULL,
        is_default BIT NOT NULL DEFAULT 0,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_user_signatures_user FOREIGN KEY (user_id) REFERENCES sec.users(user_id) ON DELETE CASCADE
    );
    PRINT 'Tabla sec.user_signatures creada';
END
ELSE
BEGIN
    PRINT 'La tabla sec.user_signatures ya existe';
END
GO

IF NOT EXISTS (SELECT 1 FROM crm.email_templates WHERE is_system = 1)
BEGIN
    INSERT INTO crm.email_templates (company_id, name, subject, body, variables, is_system) VALUES
    (1, N'Seguimiento', N'Seguimiento - {{empresa}}', N'Estimado/a {{nombre}},<br><br>Espero que se encuentre bien. Le escribo para dar seguimiento a nuestra última conversación.<br><br>Quedo atento a sus comentarios.<br><br>Saludos cordiales,', N'nombre,empresa', 1),
    (1, N'Cotización', N'Cotización - {{empresa}}', N'Estimado/a {{nombre}},<br><br>Adjunto encontrará la cotización solicitada. Estamos a su disposición para cualquier duda o aclaración.<br><br>Quedamos a la espera de su respuesta.<br><br>Saludos cordiales,', N'nombre,empresa', 1),
    (1, N'Bienvenida', N'Bienvenido/a - {{empresa}}', N'Estimado/a {{nombre}},<br><br>Bienvenido/a. Nos complace contar con usted como cliente.<br><br>Estamos a su entera disposición para atender cualquier necesidad.<br><br>Saludos cordiales,', N'nombre,empresa', 1);
    PRINT 'Plantillas del sistema insertadas';
END
ELSE
BEGIN
    PRINT 'Las plantillas del sistema ya existen';
END
GO
