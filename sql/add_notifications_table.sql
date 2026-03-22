USE crm_core;
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.tables t
  INNER JOIN sys.schemas s ON s.schema_id = t.schema_id
  WHERE s.name = 'crm' AND t.name = 'notifications'
)
BEGIN
  CREATE TABLE crm.notifications (
    notification_id  int             IDENTITY(1,1) PRIMARY KEY,
    company_id       int             NOT NULL,
    user_id          int             NOT NULL,
    type             varchar(30)     NOT NULL,
    title            nvarchar(200)   NOT NULL,
    message          nvarchar(500)   NOT NULL,
    activity_id      int             NULL,
    is_read          bit             NOT NULL CONSTRAINT DF_notifications_is_read DEFAULT (0),
    created_at       datetime2(0)    NOT NULL CONSTRAINT DF_notifications_created DEFAULT SYSUTCDATETIME(),
    read_at          datetime2(0)    NULL,

    CONSTRAINT FK_notifications_user FOREIGN KEY (company_id, user_id)
      REFERENCES sec.users(company_id, user_id),
    CONSTRAINT FK_notifications_activity FOREIGN KEY (company_id, activity_id)
      REFERENCES crm.activities(company_id, activity_id),
    CONSTRAINT CK_notifications_type CHECK (type IN ('assigned', 'due_soon', 'overdue'))
  );

  CREATE INDEX IX_notifications_user_unread
    ON crm.notifications (company_id, user_id, is_read, created_at DESC);

  PRINT 'Tabla crm.notifications creada.';
END
ELSE
BEGIN
  PRINT 'Tabla crm.notifications ya existe.';
END
GO
