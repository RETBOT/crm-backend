require("dotenv").config();
const sql = require("mssql");

async function run() {
  const pool = await sql.connect({
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    server: process.env.SQL_HOST,
    port: Number(process.env.SQL_PORT),
    database: process.env.SQL_DATABASE,
    options: {
      encrypt: process.env.SQL_ENCRYPT === "true",
      trustServerCertificate: process.env.SQL_TRUST_CERT === "true",
      enableArithAbort: true,
      instanceName: process.env.SQL_INSTANCE || undefined,
    },
  });

  await pool.request().query(`
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
    END;

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
    END;

    IF OBJECT_ID('sec.user_route_access', 'U') IS NULL
    BEGIN
      CREATE TABLE sec.user_route_access (
        company_id   INT          NOT NULL,
        user_id      INT          NOT NULL,
        route_id     INT          NOT NULL,
        created_at   DATETIME2(0) NOT NULL CONSTRAINT DF_user_route_access_created_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_user_route_access PRIMARY KEY (company_id, user_id, route_id),
        CONSTRAINT FK_user_route_access_user FOREIGN KEY (company_id, user_id)
          REFERENCES sec.users(company_id, user_id),
        CONSTRAINT FK_user_route_access_route FOREIGN KEY (company_id, route_id)
          REFERENCES crm.routes(company_id, route_id)
      );
    END;

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_user_branch_access_lookup')
      CREATE INDEX IX_user_branch_access_lookup ON sec.user_branch_access(company_id, user_id, branch_id);

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_user_route_access_lookup')
      CREATE INDEX IX_user_route_access_lookup ON sec.user_route_access(company_id, user_id, route_id);
  `);

  await pool.request().query(`
    MERGE sec.user_data_scope AS tgt
    USING (
      SELECT u.company_id, u.user_id,
        CASE
          WHEN u.is_multi_branch = 1 THEN 'ALL'
          WHEN EXISTS (
            SELECT 1 FROM crm.routes r
            WHERE r.company_id = u.company_id
              AND r.assigned_user_id = u.user_id
              AND r.status = 'ACTIVO'
          ) THEN 'ROUTE'
          ELSE 'BRANCH'
        END AS scope_type
      FROM sec.users u
      WHERE NOT EXISTS (
        SELECT 1 FROM sec.user_data_scope s
        WHERE s.company_id = u.company_id
          AND s.user_id = u.user_id
      )
    ) src
    ON tgt.company_id = src.company_id AND tgt.user_id = src.user_id
    WHEN NOT MATCHED THEN
      INSERT (company_id, user_id, scope_type, created_at, updated_at)
      VALUES (src.company_id, src.user_id, src.scope_type, SYSUTCDATETIME(), SYSUTCDATETIME());

    INSERT INTO sec.user_branch_access (company_id, user_id, branch_id, created_at)
    SELECT DISTINCT u.company_id, u.user_id, u.default_branch_id, SYSUTCDATETIME()
    FROM sec.users u
    WHERE u.default_branch_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM sec.user_branch_access uba
        WHERE uba.company_id = u.company_id
          AND uba.user_id = u.user_id
          AND uba.branch_id = u.default_branch_id
      );

    INSERT INTO sec.user_branch_access (company_id, user_id, branch_id, created_at)
    SELECT DISTINCT r.company_id, r.assigned_user_id, r.branch_id, SYSUTCDATETIME()
    FROM crm.routes r
    WHERE r.assigned_user_id IS NOT NULL
      AND r.status = 'ACTIVO'
      AND NOT EXISTS (
        SELECT 1
        FROM sec.user_branch_access uba
        WHERE uba.company_id = r.company_id
          AND uba.user_id = r.assigned_user_id
          AND uba.branch_id = r.branch_id
      );

    INSERT INTO sec.user_route_access (company_id, user_id, route_id, created_at)
    SELECT DISTINCT r.company_id, r.assigned_user_id, r.route_id, SYSUTCDATETIME()
    FROM crm.routes r
    WHERE r.assigned_user_id IS NOT NULL
      AND r.status = 'ACTIVO'
      AND NOT EXISTS (
        SELECT 1
        FROM sec.user_route_access ura
        WHERE ura.company_id = r.company_id
          AND ura.user_id = r.assigned_user_id
          AND ura.route_id = r.route_id
      );

    DELETE ura
    FROM sec.user_route_access ura
    LEFT JOIN sec.user_branch_access uba
      ON uba.company_id = ura.company_id
     AND uba.user_id = ura.user_id
     AND uba.branch_id = (
        SELECT TOP 1 r.branch_id
        FROM crm.routes r
        WHERE r.company_id = ura.company_id
          AND r.route_id = ura.route_id
     )
    WHERE uba.branch_id IS NULL;
  `);

  console.log({ ok: true, message: "Scope tables and initial assignments configured" });
  await pool.close();
}

run().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
