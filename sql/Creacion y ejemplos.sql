/* ============================================================
   CRM CORE - SQL Server Bootstrap (Multiempresa)
   ============================================================ */
USE master;
GO

IF DB_ID(N'crm_core') IS NULL
BEGIN
    CREATE DATABASE crm_core
    COLLATE Latin1_General_100_CI_AI_SC;
END
GO

ALTER DATABASE crm_core SET READ_COMMITTED_SNAPSHOT ON;
GO
ALTER DATABASE crm_core SET RECOVERY SIMPLE;
GO

USE crm_core;
GO

/* ============================================================
   1) Schemas
   ============================================================ */
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'sec') EXEC('CREATE SCHEMA sec');
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'cat') EXEC('CREATE SCHEMA cat');
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'crm') EXEC('CREATE SCHEMA crm');
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'log') EXEC('CREATE SCHEMA log');
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'api') EXEC('CREATE SCHEMA api');
GO

/* ============================================================
   2) Catalogs
   ============================================================ */
CREATE TABLE cat.positions (
    position_code              char(2)         NOT NULL PRIMARY KEY,
    position_name              nvarchar(100)   NOT NULL,
    is_active                  bit             NOT NULL CONSTRAINT DF_positions_active DEFAULT (1),
    created_at                 datetime2(0)    NOT NULL CONSTRAINT DF_positions_created DEFAULT SYSUTCDATETIME()
);
GO

CREATE TABLE cat.activity_types (
    activity_type_code         varchar(20)     NOT NULL PRIMARY KEY,
    activity_type_name         nvarchar(80)    NOT NULL,
    is_active                  bit             NOT NULL CONSTRAINT DF_activity_types_active DEFAULT (1)
);
GO

CREATE TABLE cat.priority_levels (
    priority_code              varchar(10)     NOT NULL PRIMARY KEY,
    priority_name              nvarchar(40)    NOT NULL,
    sort_order                 tinyint         NOT NULL
);
GO

CREATE TABLE cat.document_types (
    document_type_code         varchar(20)     NOT NULL PRIMARY KEY,
    document_type_name         nvarchar(80)    NOT NULL,
    is_active                  bit             NOT NULL CONSTRAINT DF_doc_types_active DEFAULT (1)
);
GO

/* ============================================================
   3) Security / Tenancy
   ============================================================ */
CREATE TABLE sec.companies (
    company_id                 int             IDENTITY(1,1) PRIMARY KEY,
    company_code               varchar(30)     NOT NULL UNIQUE,
    company_name               nvarchar(200)   NOT NULL,
    tax_id                     varchar(30)     NULL,
    email                      nvarchar(160)   NULL,
    phone                      varchar(30)     NULL,
    status                     varchar(10)     NOT NULL CONSTRAINT CK_companies_status CHECK (status IN ('ACTIVE','INACTIVE')),
    created_at                 datetime2(0)    NOT NULL CONSTRAINT DF_companies_created DEFAULT SYSUTCDATETIME(),
    updated_at                 datetime2(0)    NOT NULL CONSTRAINT DF_companies_updated DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_companies_email CHECK (email IS NULL OR email LIKE '%_@_%._%')
);
GO

CREATE TABLE crm.branches (
    branch_id                  int             IDENTITY(1,1) PRIMARY KEY,
    company_id                 int             NOT NULL,
    branch_code                varchar(20)     NOT NULL,
    branch_name                nvarchar(140)   NOT NULL,
    status                     varchar(10)     NOT NULL CONSTRAINT CK_branches_status CHECK (status IN ('ACTIVO','INACTIVO')),
    created_at                 datetime2(0)    NOT NULL CONSTRAINT DF_branches_created DEFAULT SYSUTCDATETIME(),
    updated_at                 datetime2(0)    NOT NULL CONSTRAINT DF_branches_updated DEFAULT SYSUTCDATETIME(),
    row_version                rowversion      NOT NULL,
    CONSTRAINT FK_branches_company FOREIGN KEY (company_id) REFERENCES sec.companies(company_id),
    CONSTRAINT UQ_branches_company_code UNIQUE (company_id, branch_code),
    CONSTRAINT UQ_branches_company_branchid UNIQUE (company_id, branch_id)
);
GO

CREATE TABLE sec.users (
    user_id                    int             IDENTITY(1,1) PRIMARY KEY,
    company_id                 int             NOT NULL,
    username                   varchar(50)     NOT NULL,
    display_name               nvarchar(140)   NOT NULL,
    email                      nvarchar(160)   NULL,
    password_hash              nvarchar(255)   NOT NULL, -- bcrypt/argon2
    default_branch_id          int             NULL,
    is_multi_branch            bit             NOT NULL CONSTRAINT DF_users_multi_branch DEFAULT (0),
    is_active                  bit             NOT NULL CONSTRAINT DF_users_active DEFAULT (1),
    last_login_at              datetime2(0)    NULL,
    created_at                 datetime2(0)    NOT NULL CONSTRAINT DF_users_created DEFAULT SYSUTCDATETIME(),
    updated_at                 datetime2(0)    NOT NULL CONSTRAINT DF_users_updated DEFAULT SYSUTCDATETIME(),
    row_version                rowversion      NOT NULL,
    CONSTRAINT CK_users_email CHECK (email IS NULL OR email LIKE '%_@_%._%'),
    CONSTRAINT FK_users_company FOREIGN KEY (company_id) REFERENCES sec.companies(company_id),
    CONSTRAINT FK_users_default_branch FOREIGN KEY (company_id, default_branch_id)
        REFERENCES crm.branches(company_id, branch_id),
    CONSTRAINT UQ_users_company_username UNIQUE (company_id, username),
    CONSTRAINT UQ_users_company_userid UNIQUE (company_id, user_id)
);
GO

CREATE TABLE sec.roles (
    role_id                    int             IDENTITY(1,1) PRIMARY KEY,
    company_id                 int             NOT NULL,
    role_name                  varchar(40)     NOT NULL,
    role_description           nvarchar(200)   NULL,
    is_active                  bit             NOT NULL CONSTRAINT DF_roles_active DEFAULT (1),
    CONSTRAINT FK_roles_company FOREIGN KEY (company_id) REFERENCES sec.companies(company_id),
    CONSTRAINT UQ_roles_company_name UNIQUE (company_id, role_name)
);
GO

CREATE TABLE sec.permissions (
    permission_id              int             IDENTITY(1,1) PRIMARY KEY,
    permission_key             varchar(80)     NOT NULL UNIQUE, -- e.g. customers.read
    permission_description     nvarchar(200)   NULL
);
GO

CREATE TABLE sec.role_permissions (
    role_id                    int             NOT NULL,
    permission_id              int             NOT NULL,
    PRIMARY KEY (role_id, permission_id),
    CONSTRAINT FK_role_permissions_role FOREIGN KEY (role_id) REFERENCES sec.roles(role_id),
    CONSTRAINT FK_role_permissions_permission FOREIGN KEY (permission_id) REFERENCES sec.permissions(permission_id)
);
GO

CREATE TABLE sec.user_roles (
    user_id                    int             NOT NULL,
    role_id                    int             NOT NULL,
    PRIMARY KEY (user_id, role_id),
    CONSTRAINT FK_user_roles_user FOREIGN KEY (user_id) REFERENCES sec.users(user_id),
    CONSTRAINT FK_user_roles_role FOREIGN KEY (role_id) REFERENCES sec.roles(role_id)
);
GO

CREATE TABLE sec.refresh_tokens (
    refresh_token_id           bigint          IDENTITY(1,1) PRIMARY KEY,
    user_id                    int             NOT NULL,
    token_hash                 nvarchar(255)   NOT NULL,
    expires_at                 datetime2(0)    NOT NULL,
    revoked_at                 datetime2(0)    NULL,
    created_at                 datetime2(0)    NOT NULL CONSTRAINT DF_refresh_created DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_refresh_user FOREIGN KEY (user_id) REFERENCES sec.users(user_id)
);
GO

CREATE TABLE sec.password_reset_tokens (
    reset_token_id             bigint          IDENTITY(1,1) PRIMARY KEY,
    user_id                    int             NOT NULL,
    token_hash                 nvarchar(255)   NOT NULL,
    expires_at                 datetime2(0)    NOT NULL,
    used_at                    datetime2(0)    NULL,
    created_at                 datetime2(0)    NOT NULL CONSTRAINT DF_reset_created DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_reset_user FOREIGN KEY (user_id) REFERENCES sec.users(user_id)
);
GO

/* ============================================================
   4) Sales Structure
   ============================================================ */
CREATE TABLE crm.routes (
    route_id                   int             IDENTITY(1,1) PRIMARY KEY,
    company_id                 int             NOT NULL,
    branch_id                  int             NOT NULL,
    route_code                 varchar(20)     NOT NULL,
    route_name                 nvarchar(140)   NOT NULL,
    assigned_user_id           int             NULL,
    status                     varchar(10)     NOT NULL CONSTRAINT CK_routes_status CHECK (status IN ('ACTIVO','INACTIVO')),
    created_at                 datetime2(0)    NOT NULL CONSTRAINT DF_routes_created DEFAULT SYSUTCDATETIME(),
    updated_at                 datetime2(0)    NOT NULL CONSTRAINT DF_routes_updated DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_routes_company FOREIGN KEY (company_id) REFERENCES sec.companies(company_id),
    CONSTRAINT FK_routes_branch FOREIGN KEY (company_id, branch_id) REFERENCES crm.branches(company_id, branch_id),
    CONSTRAINT FK_routes_user FOREIGN KEY (company_id, assigned_user_id) REFERENCES sec.users(company_id, user_id),
    CONSTRAINT UQ_routes_company_branch_code UNIQUE (company_id, branch_id, route_code),
    CONSTRAINT UQ_routes_company_routeid UNIQUE (company_id, route_id)
);
GO

/**************************************************************
  Customers and Contacts
**************************************************************/
CREATE TABLE crm.customers (
    customer_id                int             IDENTITY(1,1) PRIMARY KEY,
    company_id                 int             NOT NULL,
    customer_code              varchar(30)     NOT NULL,         -- CLIENTEID legado
    customer_name              nvarchar(180)   NOT NULL,         -- NOMBRECLI
    customer_type              varchar(15)     NOT NULL CONSTRAINT CK_customers_type CHECK (customer_type IN ('CLIENTE','PROSPECTO')),
    business_line              nvarchar(120)   NULL,             -- GIRO
    status                     varchar(10)     NOT NULL CONSTRAINT CK_customers_status CHECK (status IN ('ACTIVO','INACTIVO')),
    branch_id                  int             NULL,
    route_id                   int             NULL,

    street                     nvarchar(120)   NULL,             -- CALLE
    ext_number                 nvarchar(20)    NULL,             -- NUM_EXT
    neighborhood               nvarchar(120)   NULL,             -- COLONIA
    city                       nvarchar(120)   NULL,             -- CIUDAD
    state                      nvarchar(120)   NULL,             -- ESTADO
    postal_code                varchar(10)     NULL,
    email                      nvarchar(160)   NULL,
    phone                      varchar(30)     NULL,

    latitude                   decimal(9,6)    NULL,
    longitude                  decimal(9,6)    NULL,

    net_sales_3m               decimal(18,2)   NULL,             -- VENTA_NETA
    margin_pct                 decimal(5,2)    NULL,             -- MARGEN
    credit_line                decimal(18,2)   NULL,             -- LINEA_CREDITO
    exercised_amount           decimal(18,2)   NULL,             -- MONTO_EJERCIDO
    overdue_amount             decimal(18,2)   NULL,             -- CARTERA_VENCIDA
    avg_overdue_days           int             NULL,             -- PROMEDIO_DIAS_VENCIDOS
    inactive_cv                bit             NOT NULL CONSTRAINT DF_customers_inactive_cv DEFAULT (0), -- INACTIVOCV
    order_hold                 bit             NOT NULL CONSTRAINT DF_customers_order_hold DEFAULT (0),  -- RETENCION_PEDIDOS
    hold_reason                nvarchar(250)   NULL,             -- RAZON_RETENCION
    insurance_status           nvarchar(100)   NULL,             -- ASEGURANZA

    created_by_user_id         int             NULL,
    updated_by_user_id         int             NULL,
    created_at                 datetime2(0)    NOT NULL CONSTRAINT DF_customers_created DEFAULT SYSUTCDATETIME(),
    updated_at                 datetime2(0)    NOT NULL CONSTRAINT DF_customers_updated DEFAULT SYSUTCDATETIME(),
    row_version                rowversion      NOT NULL,

    CONSTRAINT FK_customers_company FOREIGN KEY (company_id) REFERENCES sec.companies(company_id),
    CONSTRAINT FK_customers_branch FOREIGN KEY (company_id, branch_id) REFERENCES crm.branches(company_id, branch_id),
    CONSTRAINT FK_customers_route FOREIGN KEY (company_id, route_id) REFERENCES crm.routes(company_id, route_id),
    CONSTRAINT FK_customers_created_by FOREIGN KEY (company_id, created_by_user_id) REFERENCES sec.users(company_id, user_id),
    CONSTRAINT FK_customers_updated_by FOREIGN KEY (company_id, updated_by_user_id) REFERENCES sec.users(company_id, user_id),
    CONSTRAINT CK_customers_email CHECK (email IS NULL OR email LIKE '%_@_%._%'),
    CONSTRAINT CK_customers_lat CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
    CONSTRAINT CK_customers_lon CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
    CONSTRAINT UQ_customers_company_code UNIQUE (company_id, customer_code),
    CONSTRAINT UQ_customers_company_customerid UNIQUE (company_id, customer_id)
);
GO

CREATE INDEX IX_customers_filters
ON crm.customers (company_id, customer_type, status, branch_id, route_id, customer_name);
GO

CREATE TABLE crm.contacts (
    contact_id                 int             IDENTITY(1,1) PRIMARY KEY,
    company_id                 int             NOT NULL,
    customer_id                int             NOT NULL,
    first_name                 nvarchar(100)   NOT NULL,   -- NOMBRE
    last_name                  nvarchar(100)   NULL,       -- APATERNO
    second_last_name           nvarchar(100)   NULL,       -- AMATERNO
    position_code              char(2)         NULL,       -- PUESTOID
    phone                      varchar(30)     NULL,       -- TELEFONO
    extension                  varchar(10)     NULL,       -- EXTENSION
    whatsapp                   varchar(30)     NULL,       -- WHATSAPP
    email                      nvarchar(160)   NULL,       -- EMAIL
    comments                   nvarchar(500)   NULL,       -- COMENTARIOS
    is_active                  bit             NOT NULL CONSTRAINT DF_contacts_active DEFAULT (1),
    created_at                 datetime2(0)    NOT NULL CONSTRAINT DF_contacts_created DEFAULT SYSUTCDATETIME(),
    updated_at                 datetime2(0)    NOT NULL CONSTRAINT DF_contacts_updated DEFAULT SYSUTCDATETIME(),
    row_version                rowversion      NOT NULL,
    CONSTRAINT FK_contacts_customer FOREIGN KEY (company_id, customer_id) REFERENCES crm.customers(company_id, customer_id),
    CONSTRAINT FK_contacts_position FOREIGN KEY (position_code) REFERENCES cat.positions(position_code),
    CONSTRAINT CK_contacts_email CHECK (email IS NULL OR email LIKE '%_@_%._%'),
    CONSTRAINT UQ_contacts_company_contactid UNIQUE (company_id, contact_id)
);
GO

CREATE INDEX IX_contacts_customer_active
ON crm.contacts (company_id, customer_id, is_active, first_name);
GO

/* ============================================================
   5) Pipeline, Opportunities, Activities
   ============================================================ */
CREATE TABLE crm.sales_pipelines (
    pipeline_id                int             IDENTITY(1,1) PRIMARY KEY,
    company_id                 int             NOT NULL,
    pipeline_name              nvarchar(120)   NOT NULL,
    is_default                 bit             NOT NULL CONSTRAINT DF_pipelines_default DEFAULT (0),
    is_active                  bit             NOT NULL CONSTRAINT DF_pipelines_active DEFAULT (1),
    CONSTRAINT FK_pipelines_company FOREIGN KEY (company_id) REFERENCES sec.companies(company_id),
    CONSTRAINT UQ_pipelines_company_name UNIQUE (company_id, pipeline_name),
    CONSTRAINT UQ_pipelines_company_pipelineid UNIQUE (company_id, pipeline_id)
);
GO

CREATE TABLE crm.pipeline_stages (
    stage_id                   int             IDENTITY(1,1) PRIMARY KEY,
    company_id                 int             NOT NULL,
    pipeline_id                int             NOT NULL,
    stage_code                 varchar(20)     NOT NULL, -- contacto/cotizacion/...
    stage_name                 nvarchar(120)   NOT NULL,
    stage_order                int             NOT NULL,
    default_probability_pct    decimal(5,2)    NULL,
    is_closed                  bit             NOT NULL CONSTRAINT DF_stages_closed DEFAULT (0),
    is_won                     bit             NOT NULL CONSTRAINT DF_stages_won DEFAULT (0),
    is_active                  bit             NOT NULL CONSTRAINT DF_stages_active DEFAULT (1),
    CONSTRAINT FK_stages_pipeline FOREIGN KEY (company_id, pipeline_id) REFERENCES crm.sales_pipelines(company_id, pipeline_id),
    CONSTRAINT UQ_stages_company_pipeline_code UNIQUE (company_id, pipeline_id, stage_code),
    CONSTRAINT UQ_stages_company_stageid UNIQUE (company_id, stage_id)
);
GO

CREATE TABLE crm.products (
    product_id                 int             IDENTITY(1,1) PRIMARY KEY,
    company_id                 int             NOT NULL,
    sku                        varchar(40)     NOT NULL,
    product_name               nvarchar(180)   NOT NULL,
    description                nvarchar(500)   NULL,
    unit_price                 decimal(18,2)   NULL,
    is_active                  bit             NOT NULL CONSTRAINT DF_products_active DEFAULT (1),
    created_at                 datetime2(0)    NOT NULL CONSTRAINT DF_products_created DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_products_company FOREIGN KEY (company_id) REFERENCES sec.companies(company_id),
    CONSTRAINT UQ_products_company_sku UNIQUE (company_id, sku),
    CONSTRAINT UQ_products_company_productid UNIQUE (company_id, product_id)
);
GO

CREATE TABLE crm.opportunities (
    opportunity_id             int             IDENTITY(1,1) PRIMARY KEY,
    company_id                 int             NOT NULL,
    customer_id                int             NOT NULL,
    contact_id                 int             NULL,
    owner_user_id              int             NULL,
    pipeline_id                int             NOT NULL,
    stage_id                   int             NOT NULL,
    title                      nvarchar(180)   NOT NULL,
    description                nvarchar(1000)  NULL,
    amount                     decimal(18,2)   NULL,
    close_date                 date            NULL,
    probability_pct            decimal(5,2)    NULL,
    status                     varchar(20)     NOT NULL CONSTRAINT CK_opportunity_status CHECK (status IN ('abierta','ganada','perdida')),
    lost_reason                nvarchar(250)   NULL,
    created_at                 datetime2(0)    NOT NULL CONSTRAINT DF_opps_created DEFAULT SYSUTCDATETIME(),
    updated_at                 datetime2(0)    NOT NULL CONSTRAINT DF_opps_updated DEFAULT SYSUTCDATETIME(),
    row_version                rowversion      NOT NULL,
    CONSTRAINT FK_opps_company FOREIGN KEY (company_id) REFERENCES sec.companies(company_id),
    CONSTRAINT FK_opps_customer FOREIGN KEY (company_id, customer_id) REFERENCES crm.customers(company_id, customer_id),
    CONSTRAINT FK_opps_contact FOREIGN KEY (company_id, contact_id) REFERENCES crm.contacts(company_id, contact_id),
    CONSTRAINT FK_opps_owner FOREIGN KEY (company_id, owner_user_id) REFERENCES sec.users(company_id, user_id),
    CONSTRAINT FK_opps_pipeline FOREIGN KEY (company_id, pipeline_id) REFERENCES crm.sales_pipelines(company_id, pipeline_id),
    CONSTRAINT FK_opps_stage FOREIGN KEY (company_id, stage_id) REFERENCES crm.pipeline_stages(company_id, stage_id),
    CONSTRAINT UQ_opps_company_oppid UNIQUE (company_id, opportunity_id)
);
GO

CREATE INDEX IX_opps_dashboard
ON crm.opportunities (company_id, status, owner_user_id, stage_id, close_date);
GO

CREATE TABLE crm.opportunity_items (
    opportunity_item_id        int             IDENTITY(1,1) PRIMARY KEY,
    company_id                 int             NOT NULL,
    opportunity_id             int             NOT NULL,
    product_id                 int             NULL,
    item_description           nvarchar(250)   NOT NULL,
    quantity                   decimal(18,3)   NOT NULL CONSTRAINT DF_opp_items_qty DEFAULT (1),
    unit_price                 decimal(18,2)   NOT NULL CONSTRAINT DF_opp_items_price DEFAULT (0),
    discount_pct               decimal(5,2)    NOT NULL CONSTRAINT DF_opp_items_discount DEFAULT (0),
    CONSTRAINT FK_opp_items_opp FOREIGN KEY (company_id, opportunity_id) REFERENCES crm.opportunities(company_id, opportunity_id),
    CONSTRAINT FK_opp_items_product FOREIGN KEY (company_id, product_id) REFERENCES crm.products(company_id, product_id)
);
GO

CREATE TABLE crm.activities (
    activity_id                int             IDENTITY(1,1) PRIMARY KEY,
    company_id                 int             NOT NULL,
    customer_id                int             NOT NULL,
    contact_id                 int             NULL,
    opportunity_id             int             NULL,
    owner_user_id              int             NULL,
    activity_type_code         varchar(20)     NOT NULL,
    subject                    nvarchar(200)   NOT NULL,
    notes                      nvarchar(1000)  NULL,
    due_at                     datetime2(0)    NULL,
    completed_at               datetime2(0)    NULL,
    status                     varchar(20)     NOT NULL CONSTRAINT CK_activities_status CHECK (status IN ('Pendiente','Programada','Completada','Cancelada')),
    priority_code              varchar(10)     NOT NULL,
    created_at                 datetime2(0)    NOT NULL CONSTRAINT DF_activities_created DEFAULT SYSUTCDATETIME(),
    updated_at                 datetime2(0)    NOT NULL CONSTRAINT DF_activities_updated DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_activities_customer FOREIGN KEY (company_id, customer_id) REFERENCES crm.customers(company_id, customer_id),
    CONSTRAINT FK_activities_contact FOREIGN KEY (company_id, contact_id) REFERENCES crm.contacts(company_id, contact_id),
    CONSTRAINT FK_activities_opp FOREIGN KEY (company_id, opportunity_id) REFERENCES crm.opportunities(company_id, opportunity_id),
    CONSTRAINT FK_activities_owner FOREIGN KEY (company_id, owner_user_id) REFERENCES sec.users(company_id, user_id),
    CONSTRAINT FK_activities_type FOREIGN KEY (activity_type_code) REFERENCES cat.activity_types(activity_type_code),
    CONSTRAINT FK_activities_priority FOREIGN KEY (priority_code) REFERENCES cat.priority_levels(priority_code),
    CONSTRAINT UQ_activities_company_activityid UNIQUE (company_id, activity_id)
);
GO

CREATE INDEX IX_activities_dashboard
ON crm.activities (company_id, status, due_at, owner_user_id);
GO

/**************************************************************
  Quotations
**************************************************************/
CREATE TABLE crm.quotations (
    quotation_id               int             IDENTITY(1,1) PRIMARY KEY,
    company_id                 int             NOT NULL,
    quotation_number           varchar(40)     NOT NULL,
    customer_id                int             NOT NULL,
    opportunity_id             int             NULL,
    issue_date                 date            NOT NULL,
    expiration_date            date            NULL,
    currency_code              char(3)         NOT NULL CONSTRAINT DF_quotes_currency DEFAULT ('MXN'),
    subtotal                   decimal(18,2)   NOT NULL CONSTRAINT DF_quotes_subtotal DEFAULT (0),
    tax_amount                 decimal(18,2)   NOT NULL CONSTRAINT DF_quotes_tax DEFAULT (0),
    total_amount               decimal(18,2)   NOT NULL CONSTRAINT DF_quotes_total DEFAULT (0),
    status                     varchar(20)     NOT NULL CONSTRAINT CK_quotes_status CHECK (status IN ('draft','sent','accepted','rejected','expired')),
    notes                      nvarchar(1000)  NULL,
    created_by_user_id         int             NULL,
    created_at                 datetime2(0)    NOT NULL CONSTRAINT DF_quotes_created DEFAULT SYSUTCDATETIME(),
    updated_at                 datetime2(0)    NOT NULL CONSTRAINT DF_quotes_updated DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_quotes_customer FOREIGN KEY (company_id, customer_id) REFERENCES crm.customers(company_id, customer_id),
    CONSTRAINT FK_quotes_opp FOREIGN KEY (company_id, opportunity_id) REFERENCES crm.opportunities(company_id, opportunity_id),
    CONSTRAINT FK_quotes_user FOREIGN KEY (company_id, created_by_user_id) REFERENCES sec.users(company_id, user_id),
    CONSTRAINT UQ_quotes_company_number UNIQUE (company_id, quotation_number),
    CONSTRAINT UQ_quotes_company_quoteid UNIQUE (company_id, quotation_id)
);
GO

CREATE TABLE crm.quotation_items (
    quotation_item_id          int             IDENTITY(1,1) PRIMARY KEY,
    company_id                 int             NOT NULL,
    quotation_id               int             NOT NULL,
    product_id                 int             NULL,
    item_description           nvarchar(250)   NOT NULL,
    quantity                   decimal(18,3)   NOT NULL CONSTRAINT DF_quote_items_qty DEFAULT (1),
    unit_price                 decimal(18,2)   NOT NULL CONSTRAINT DF_quote_items_price DEFAULT (0),
    discount_pct               decimal(5,2)    NOT NULL CONSTRAINT DF_quote_items_discount DEFAULT (0),
    line_total                 decimal(18,2)   NOT NULL CONSTRAINT DF_quote_items_total DEFAULT (0),
    CONSTRAINT FK_quote_items_quote FOREIGN KEY (company_id, quotation_id) REFERENCES crm.quotations(company_id, quotation_id),
    CONSTRAINT FK_quote_items_product FOREIGN KEY (company_id, product_id) REFERENCES crm.products(company_id, product_id)
);
GO

/**************************************************************
  Notes, Documents, Audit
**************************************************************/
CREATE TABLE crm.customer_notes (
    note_id                    bigint          IDENTITY(1,1) PRIMARY KEY,
    company_id                 int             NOT NULL,
    customer_id                int             NOT NULL,
    note_text                  nvarchar(2000)  NOT NULL,
    created_by_user_id         int             NULL,
    created_at                 datetime2(0)    NOT NULL CONSTRAINT DF_notes_created DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_notes_customer FOREIGN KEY (company_id, customer_id) REFERENCES crm.customers(company_id, customer_id),
    CONSTRAINT FK_notes_user FOREIGN KEY (company_id, created_by_user_id) REFERENCES sec.users(company_id, user_id)
);
GO

CREATE TABLE crm.documents (
    document_id                bigint          IDENTITY(1,1) PRIMARY KEY,
    company_id                 int             NOT NULL,
    document_type_code         varchar(20)     NOT NULL,
    customer_id                int             NULL,
    contact_id                 int             NULL,
    opportunity_id             int             NULL,
    quotation_id               int             NULL,
    file_name                  nvarchar(255)   NOT NULL,
    file_ext                   varchar(15)     NULL,
    mime_type                  varchar(100)    NULL,
    file_size_bytes            bigint          NULL,
    storage_path               nvarchar(500)   NOT NULL,
    uploaded_by_user_id        int             NULL,
    uploaded_at                datetime2(0)    NOT NULL CONSTRAINT DF_docs_uploaded DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_docs_type FOREIGN KEY (document_type_code) REFERENCES cat.document_types(document_type_code),
    CONSTRAINT FK_docs_customer FOREIGN KEY (company_id, customer_id) REFERENCES crm.customers(company_id, customer_id),
    CONSTRAINT FK_docs_contact FOREIGN KEY (company_id, contact_id) REFERENCES crm.contacts(company_id, contact_id),
    CONSTRAINT FK_docs_opp FOREIGN KEY (company_id, opportunity_id) REFERENCES crm.opportunities(company_id, opportunity_id),
    CONSTRAINT FK_docs_quote FOREIGN KEY (company_id, quotation_id) REFERENCES crm.quotations(company_id, quotation_id),
    CONSTRAINT FK_docs_user FOREIGN KEY (company_id, uploaded_by_user_id) REFERENCES sec.users(company_id, user_id)
);
GO

CREATE TABLE log.audit_events (
    audit_event_id             bigint          IDENTITY(1,1) PRIMARY KEY,
    company_id                 int             NULL,
    user_id                    int             NULL,
    event_at                   datetime2(0)    NOT NULL CONSTRAINT DF_audit_event_at DEFAULT SYSUTCDATETIME(),
    event_type                 varchar(50)     NOT NULL,     -- INSERT/UPDATE/DELETE/LOGIN/...
    entity_name                varchar(80)     NOT NULL,     -- customers/contacts/...
    entity_id                  varchar(80)     NULL,
    ip_address                 varchar(45)     NULL,
    user_agent                 nvarchar(300)   NULL,
    payload_json               nvarchar(max)   NULL
);
GO

/* ============================================================
   6) Compatibility Views for Current Frontend
   ============================================================ */
CREATE VIEW api.vw_cn_sucursal
AS
SELECT
    b.branch_id AS ID,
    b.branch_name AS DSC
FROM crm.branches b
WHERE b.status = 'ACTIVO';
GO

CREATE VIEW api.vw_cn_rutas
AS
SELECT
    r.route_id AS ID,
    r.route_name AS DSC,
    r.branch_id AS SUCURSALID
FROM crm.routes r
WHERE r.status = 'ACTIVO';
GO

CREATE VIEW api.vw_cn_clientes
AS
SELECT
    c.company_id,
    c.customer_id,
    c.customer_code AS CLIENTEID,
    c.customer_name AS NOMBRECLI,
    c.business_line AS GIRO,
    c.street AS CALLE,
    c.ext_number AS NUM_EXT,
    c.neighborhood AS COLONIA,
    c.city AS CIUDAD,
    c.state AS ESTADO,
    c.email AS EMAIL,
    c.phone AS TEL,
    c.status AS ESTATUS,
    b.branch_name AS SUCURSAL,
    r.route_id AS RUTAID,
    r.route_name AS RUTA,
    c.latitude AS LAT,
    c.longitude AS LON,
    c.net_sales_3m AS VENTA_NETA,
    c.margin_pct AS MARGEN,
    c.credit_line AS LINEA_CREDITO,
    c.exercised_amount AS MONTO_EJERCIDO,
    c.overdue_amount AS CARTERA_VENCIDA,
    c.avg_overdue_days AS PROMEDIO_DIAS_VENCIDOS,
    CASE WHEN c.inactive_cv = 1 THEN 'SI' ELSE 'NO' END AS INACTIVOCV,
    CASE WHEN c.order_hold = 1 THEN 'SI' ELSE 'NO' END AS RETENCION_PEDIDOS,
    c.hold_reason AS RAZON_RETENCION,
    c.insurance_status AS ASEGURANZA,
    c.customer_type AS TIPO
FROM crm.customers c
LEFT JOIN crm.branches b
  ON b.company_id = c.company_id AND b.branch_id = c.branch_id
LEFT JOIN crm.routes r
  ON r.company_id = c.company_id AND r.route_id = c.route_id;
GO

CREATE VIEW api.vw_cn_contactos
AS
SELECT
    ct.company_id,
    ct.contact_id AS ID,
    ct.customer_id,
    c.customer_code AS CLIENTEID,
    ct.first_name AS NOMBRE,
    ct.last_name AS APATERNO,
    ct.second_last_name AS AMATERNO,
    ct.phone AS TELEFONO,
    ct.extension AS EXTENSION,
    ct.position_code AS PUESTOID,
    p.position_name AS PUESTO,
    ct.comments AS COMENTARIOS,
    ct.whatsapp AS WHATSAPP,
    ct.email AS EMAIL,
    ct.is_active
FROM crm.contacts ct
INNER JOIN crm.customers c
  ON c.company_id = ct.company_id AND c.customer_id = ct.customer_id
LEFT JOIN cat.positions p
  ON p.position_code = ct.position_code;
GO

/* ============================================================
   7) Seed Data (Generic)
   ============================================================ */
INSERT INTO cat.positions (position_code, position_name) VALUES
('03', N'COMPRAS'),
('04', N'PAGOS'),
('05', N'OPERACIONES'),
('06', N'ALMACEN'),
('07', N'INGENIERIA');

INSERT INTO cat.activity_types (activity_type_code, activity_type_name) VALUES
('Llamada', N'Llamada'),
('Reunion', N'Reunion'),
('Correo', N'Correo'),
('Visita', N'Visita'),
('Tarea', N'Tarea');

INSERT INTO cat.priority_levels (priority_code, priority_name, sort_order) VALUES
('Alta', N'Alta', 1),
('Media', N'Media', 2),
('Baja', N'Baja', 3);

INSERT INTO cat.document_types (document_type_code, document_type_name) VALUES
('QUOTE', N'Cotizacion'),
('CONTRACT', N'Contrato'),
('TECH', N'Ficha tecnica'),
('OTHER', N'Otro');

INSERT INTO sec.companies (company_code, company_name, tax_id, email, phone, status)
VALUES ('DEMO001', N'Empresa Demo', 'XAXX010101000', N'admin@empresademo.com', '5550000000', 'ACTIVE');

DECLARE @company_id int = (SELECT company_id FROM sec.companies WHERE company_code = 'DEMO001');

INSERT INTO crm.branches (company_id, branch_code, branch_name, status) VALUES
(@company_id, 'LAG', N'LAGUNA', 'ACTIVO'),
(@company_id, 'SAL', N'SALTILLO', 'ACTIVO'),
(@company_id, 'QRO', N'QUERETARO', 'ACTIVO'),
(@company_id, 'MTY', N'MONTERREY', 'ACTIVO');

DECLARE @branch_lag int = (SELECT branch_id FROM crm.branches WHERE company_id=@company_id AND branch_code='LAG');
DECLARE @branch_sal int = (SELECT branch_id FROM crm.branches WHERE company_id=@company_id AND branch_code='SAL');
DECLARE @branch_qro int = (SELECT branch_id FROM crm.branches WHERE company_id=@company_id AND branch_code='QRO');
DECLARE @branch_mty int = (SELECT branch_id FROM crm.branches WHERE company_id=@company_id AND branch_code='MTY');

-- Password hash de ejemplo. Reemplazar en backend con bcrypt hash real.
INSERT INTO sec.users (company_id, username, display_name, email, password_hash, default_branch_id, is_multi_branch, is_active) VALUES
(@company_id, 'admin', N'Administrador', N'admin@empresademo.com', '$2b$12$REEMPLAZAR_HASH_REAL', @branch_lag, 1, 1),
(@company_id, 'usr_laguna', N'1 LAGUNA', N'laguna@empresademo.com', '$2b$12$REEMPLAZAR_HASH_REAL', @branch_lag, 0, 1),
(@company_id, 'usr_saltillo', N'1 SALTILLO', N'saltillo@empresademo.com', '$2b$12$REEMPLAZAR_HASH_REAL', @branch_sal, 0, 1),
(@company_id, 'usr_qro', N'DISPONIBLE QUERETARO', N'qro@empresademo.com', '$2b$12$REEMPLAZAR_HASH_REAL', @branch_qro, 0, 1),
(@company_id, 'usr_mty', N'3 MONTERREY', N'mty@empresademo.com', '$2b$12$REEMPLAZAR_HASH_REAL', @branch_mty, 0, 1);

DECLARE @admin_user int = (SELECT user_id FROM sec.users WHERE company_id=@company_id AND username='admin');
DECLARE @user_lag int = (SELECT user_id FROM sec.users WHERE company_id=@company_id AND username='usr_laguna');
DECLARE @user_sal int = (SELECT user_id FROM sec.users WHERE company_id=@company_id AND username='usr_saltillo');
DECLARE @user_qro int = (SELECT user_id FROM sec.users WHERE company_id=@company_id AND username='usr_qro');
DECLARE @user_mty int = (SELECT user_id FROM sec.users WHERE company_id=@company_id AND username='usr_mty');

INSERT INTO crm.routes (company_id, branch_id, route_code, route_name, assigned_user_id, status) VALUES
(@company_id, @branch_lag, 'R-101', N'RUTA LAGUNA NORTE', @user_lag, 'ACTIVO'),
(@company_id, @branch_lag, 'R-102', N'RUTA LAGUNA SUR', @user_lag, 'ACTIVO'),
(@company_id, @branch_sal, 'R-201', N'RUTA SALTILLO CENTRO', @user_sal, 'ACTIVO'),
(@company_id, @branch_qro, 'R-301', N'RUTA QUERETARO INDUSTRIAL', @user_qro, 'ACTIVO'),
(@company_id, @branch_mty, 'R-401', N'RUTA MONTERREY ORIENTE', @user_mty, 'ACTIVO');

DECLARE @route_lag_n int = (SELECT route_id FROM crm.routes WHERE company_id=@company_id AND route_code='R-101');
DECLARE @route_sal_c int = (SELECT route_id FROM crm.routes WHERE company_id=@company_id AND route_code='R-201');
DECLARE @route_qro_i int = (SELECT route_id FROM crm.routes WHERE company_id=@company_id AND route_code='R-301');
DECLARE @route_mty_o int = (SELECT route_id FROM crm.routes WHERE company_id=@company_id AND route_code='R-401');

INSERT INTO crm.customers (
    company_id, customer_code, customer_name, customer_type, business_line, status, branch_id, route_id,
    street, ext_number, neighborhood, city, state, postal_code, email, phone, latitude, longitude,
    net_sales_3m, margin_pct, credit_line, exercised_amount, overdue_amount, avg_overdue_days,
    inactive_cv, order_hold, hold_reason, insurance_status, created_by_user_id, updated_by_user_id
) VALUES
(@company_id, '100001', N'SUMITOMO ELECTRIC WIRING SYSTEMS, INC.', 'CLIENTE', N'AUTOMOTRIZ', 'ACTIVO', @branch_lag, @route_lag_n,
 N'AV INDUSTRIA', N'1200', N'PARQUE INDUSTRIAL', N'TORREON', N'COAHUILA', '27000',
 N'compras@sumitomo.demo', '8717307940', 25.539000, -103.445300,
 450000.00, 18.50, 300000.00, 180000.00, 0.00, 0, 0, 0, NULL, N'VIGENTE', @admin_user, @admin_user),

(@company_id, '100002', N'WHIRLPOOL INTERNACIONAL', 'CLIENTE', N'LINEA BLANCA', 'ACTIVO', @branch_sal, @route_sal_c,
 N'BLVD INDUSTRIAL', N'455', N'PARQUE NORTE', N'SALTILLO', N'COAHUILA', '25230',
 N'sourcing@whirlpool.demo', '8448664585', 25.426700, -100.995000,
 280000.00, 16.10, 220000.00, 140000.00, 12000.00, 24, 0, 0, NULL, N'VIGENTE', @admin_user, @admin_user),

(@company_id, '100003', N'NIPPON STEEL PIPE MEXICO S.A. DE C.V.', 'CLIENTE', N'METALMECANICA', 'ACTIVO', @branch_qro, @route_qro_i,
 N'CARRETERA 57', N'KM12', N'ZONA INDUSTRIAL', N'QUERETARO', N'QUERETARO', '76000',
 N'compras@nippon.demo', '4421234567', 20.588800, -100.389900,
 320000.00, 19.40, 250000.00, 165000.00, 0.00, 0, 0, 0, NULL, N'VIGENTE', @admin_user, @admin_user),

(@company_id, '100004', N'BADAFI', 'CLIENTE', N'ALIMENTOS', 'ACTIVO', @branch_mty, @route_mty_o,
 N'AV CONSTITUCION', N'850', N'CENTRO', N'MONTERREY', N'NUEVO LEON', '64000',
 N'compras@badafi.demo', '8188880000', 25.686600, -100.316100,
 95000.00, 12.20, 100000.00, 85000.00, 15000.00, 36, 1, 1, N'DOCUMENTACION INCOMPLETA', N'NO APLICA', @admin_user, @admin_user),

(@company_id, '200001', N'ARNECOM', 'PROSPECTO', N'AUTOPARTES', 'ACTIVO', @branch_mty, @route_mty_o,
 N'AV TECNOLOGICO', N'300', N'INDUSTRIAL', N'MONTERREY', N'NUEVO LEON', '64500',
 N'contacto@arnecom.demo', '8180001111', 25.700000, -100.350000,
 NULL, NULL, NULL, NULL, NULL, NULL, 0, 0, NULL, NULL, @admin_user, @admin_user);

DECLARE @c1 int = (SELECT customer_id FROM crm.customers WHERE company_id=@company_id AND customer_code='100001');
DECLARE @c2 int = (SELECT customer_id FROM crm.customers WHERE company_id=@company_id AND customer_code='100002');
DECLARE @c3 int = (SELECT customer_id FROM crm.customers WHERE company_id=@company_id AND customer_code='100003');
DECLARE @c4 int = (SELECT customer_id FROM crm.customers WHERE company_id=@company_id AND customer_code='100004');

INSERT INTO crm.contacts (
    company_id, customer_id, first_name, last_name, second_last_name, position_code,
    phone, extension, whatsapp, email, comments, is_active
) VALUES
(@company_id, @c1, N'FRANCISCO', N'FAVELA', NULL, '03', '8717307940', '1312', NULL, N'francisco.favela@sumitomo.demo', N'Prefiere contacto por la manana', 1),
(@company_id, @c2, N'LUISSANA', N'MARROQUIN', NULL, '03', '8448664585', NULL, NULL, N'luissana@whirlpool.demo', N'Contacto clave para volumen', 1),
(@company_id, @c3, N'TAMARA', N'BEJARANO', NULL, '06', '4421234567', NULL, '5576543210', N'tamara@nippon.demo', N'Coordina recepcion en almacen', 1),
(@company_id, @c4, N'JESUS', N'SANTIBANEZ', NULL, '07', '8188880000', NULL, '5565432109', N'jesus@badafi.demo', N'Seguimiento tecnico', 1);

INSERT INTO crm.products (company_id, sku, product_name, description, unit_price, is_active) VALUES
(@company_id, 'PEL-STRETCH-001', N'Pelicula Stretch', N'Rollo industrial', 850.00, 1),
(@company_id, 'FLEJ-PP-001', N'Fleje PP', N'Fleje de polipropileno', 420.00, 1),
(@company_id, 'CINTA-ADH-001', N'Cinta Adhesiva', N'Cinta industrial', 95.00, 1);

INSERT INTO crm.sales_pipelines (company_id, pipeline_name, is_default, is_active)
VALUES (@company_id, N'Pipeline Comercial General', 1, 1);

DECLARE @pipeline_id int = (SELECT pipeline_id FROM crm.sales_pipelines WHERE company_id=@company_id AND pipeline_name=N'Pipeline Comercial General');

INSERT INTO crm.pipeline_stages (company_id, pipeline_id, stage_code, stage_name, stage_order, default_probability_pct, is_closed, is_won, is_active) VALUES
(@company_id, @pipeline_id, 'contacto',    N'Contacto Inicial', 1, 20, 0, 0, 1),
(@company_id, @pipeline_id, 'cotizacion',  N'Cotizacion',       2, 40, 0, 0, 1),
(@company_id, @pipeline_id, 'propuesta',   N'Propuesta',        3, 60, 0, 0, 1),
(@company_id, @pipeline_id, 'negociacion', N'Negociacion',      4, 80, 0, 0, 1),
(@company_id, @pipeline_id, 'cerrada_g',   N'Cerrada Ganada',   5, 100, 1, 1, 1),
(@company_id, @pipeline_id, 'cerrada_p',   N'Cerrada Perdida',  6, 0, 1, 0, 1);

DECLARE @stage_neg int = (
    SELECT stage_id FROM crm.pipeline_stages
    WHERE company_id=@company_id AND pipeline_id=@pipeline_id AND stage_code='negociacion'
);

INSERT INTO crm.opportunities (
    company_id, customer_id, owner_user_id, pipeline_id, stage_id,
    title, description, amount, close_date, probability_pct, status
) VALUES
(@company_id, @c1, @user_lag, @pipeline_id, @stage_neg,
 N'Pedido anual de pelicula stretch', N'Suministro para 3 plantas durante 12 meses',
 450000.00, DATEADD(DAY, 45, CAST(GETDATE() AS date)), 75.00, 'abierta');

DECLARE @opp1 int = SCOPE_IDENTITY();

DECLARE @prod1 int = (SELECT product_id FROM crm.products WHERE company_id=@company_id AND sku='PEL-STRETCH-001');

INSERT INTO crm.opportunity_items (company_id, opportunity_id, product_id, item_description, quantity, unit_price, discount_pct)
VALUES (@company_id, @opp1, @prod1, N'Pelicula stretch 20 micras', 500.000, 850.00, 5.00);

INSERT INTO crm.activities (
    company_id, customer_id, opportunity_id, owner_user_id,
    activity_type_code, subject, notes, due_at, status, priority_code
) VALUES
(@company_id, @c1, @opp1, @user_lag, 'Llamada', N'Seguimiento comercial', N'Validar volumen mensual', DATEADD(DAY, 2, SYSUTCDATETIME()), 'Programada', 'Alta'),
(@company_id, @c2, NULL, @user_sal, 'Correo', N'Enviar cotizacion inicial', N'Adjuntar terminos de pago', DATEADD(DAY, 1, SYSUTCDATETIME()), 'Pendiente', 'Media');

INSERT INTO crm.quotations (
    company_id, quotation_number, customer_id, opportunity_id, issue_date, expiration_date,
    currency_code, subtotal, tax_amount, total_amount, status, created_by_user_id
) VALUES
(@company_id, 'Q-2026-0001', @c1, @opp1, CAST(GETDATE() AS date), DATEADD(DAY, 15, CAST(GETDATE() AS date)),
 'MXN', 403750.00, 64600.00, 468350.00, 'sent', @user_lag);

DECLARE @quote1 int = SCOPE_IDENTITY();

INSERT INTO crm.quotation_items (
    company_id, quotation_id, product_id, item_description, quantity, unit_price, discount_pct, line_total
) VALUES
(@company_id, @quote1, @prod1, N'Pelicula stretch 20 micras', 500.000, 850.00, 5.00, 403750.00);

INSERT INTO crm.customer_notes (company_id, customer_id, note_text, created_by_user_id)
VALUES (@company_id, @c1, N'Cliente estrategico. Revisar propuesta de credito trimestral.', @admin_user);

INSERT INTO log.audit_events (company_id, user_id, event_type, entity_name, entity_id, payload_json)
VALUES (@company_id, @admin_user, 'SEED', 'database', 'initial', N'{"status":"ok","source":"bootstrap"}');

/* ============================================================
   8) Helpful Indexes
   ============================================================ */
CREATE INDEX IX_routes_company_branch ON crm.routes(company_id, branch_id, status);
CREATE INDEX IX_users_company_active ON sec.users(company_id, is_active, username);
CREATE INDEX IX_quotes_company_status ON crm.quotations(company_id, status, issue_date);
CREATE INDEX IX_docs_company_customer ON crm.documents(company_id, customer_id, uploaded_at);
GO
