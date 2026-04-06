USE crm_core;
GO

IF OBJECT_ID('sec.user_data_scope', 'U') IS NULL
BEGIN
  CREATE TABLE sec.user_data_scope (
    company_id   INT          NOT NULL,
    user_id      INT          NOT NULL,
    scope_type   VARCHAR(10)  NOT NULL,
    created_at   DATETIME2(0) NOT NULL CONSTRAINT DF_user_data_scope_created_at DEFAULT SYSUTCDATETIME(),
    updated_at   DATETIME2(0) NOT NULL CONSTRAINT DF_user_data_scope_updated_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_user_data_scope PRIMARY KEY (company_id, user_id),
    CONSTRAINT FK_user_data_scope_user FOREIGN KEY (company_id, user_id)
      REFERENCES sec.users(company_id, user_id),
    CONSTRAINT CK_user_data_scope_type CHECK (scope_type IN ('ALL', 'BRANCH', 'ROUTE'))
  );
END
GO

IF OBJECT_ID('sec.user_branch_access', 'U') IS NULL
BEGIN
  CREATE TABLE sec.user_branch_access (
    company_id   INT          NOT NULL,
    user_id      INT          NOT NULL,
    branch_id    INT          NOT NULL,
    created_at   DATETIME2(0) NOT NULL CONSTRAINT DF_user_branch_access_created_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_user_branch_access PRIMARY KEY (company_id, user_id, branch_id),
    CONSTRAINT FK_user_branch_access_user FOREIGN KEY (company_id, user_id)
      REFERENCES sec.users(company_id, user_id),
    CONSTRAINT FK_user_branch_access_branch FOREIGN KEY (company_id, branch_id)
      REFERENCES crm.branches(company_id, branch_id)
  );
END
GO

IF OBJECT_ID('sec.user_vendedor_access', 'U') IS NULL
BEGIN
  CREATE TABLE sec.user_vendedor_access (
    company_id   INT          NOT NULL,
    user_id      INT          NOT NULL,
    vendedor_id  INT          NOT NULL,
    created_at   DATETIME2(0) NOT NULL CONSTRAINT DF_user_vendedor_access_created_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_user_vendedor_access PRIMARY KEY (company_id, user_id, vendedor_id),
    CONSTRAINT FK_user_vendedor_access_user FOREIGN KEY (company_id, user_id)
      REFERENCES sec.users(company_id, user_id),
    CONSTRAINT FK_user_vendedor_access_vendedor FOREIGN KEY (company_id, vendedor_id)
      REFERENCES crm.vendedores(company_id, vendedor_id)
  );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_user_branch_access_lookup')
BEGIN
  CREATE INDEX IX_user_branch_access_lookup
    ON sec.user_branch_access(company_id, user_id, branch_id);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_user_vendedor_access_lookup')
BEGIN
  CREATE INDEX IX_user_vendedor_access_lookup
    ON sec.user_vendedor_access(company_id, user_id, vendedor_id);
END
GO
