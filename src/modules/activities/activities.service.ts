import { getPool, sql } from "../../db/sqlserver";
import { HttpError } from "../../shared/http-error";
import { resolveUserScope } from "../scope/scope.service";
import {
  ActivitiesListInput,
  ActivityCompleteInput,
  ActivityCreateInput,
  ActivityUpdateInput,
} from "./activities.schemas";

function buildScopeConditionSql(alias: string): string {
  return `
    EXISTS (
      SELECT 1
      FROM crm.customers cscope
      WHERE cscope.company_id = ${alias}.company_id
        AND cscope.customer_id = ${alias}.customer_id
        AND (
          @scope_type = 'ALL'
          OR (
            cscope.branch_id IN (
              SELECT TRY_CAST(value AS INT)
              FROM STRING_SPLIT(@branch_ids_csv, ',')
              WHERE TRY_CAST(value AS INT) IS NOT NULL
            )
            AND (
              @scope_type = 'BRANCH'
              OR cscope.route_id IN (
                SELECT TRY_CAST(value AS INT)
                FROM STRING_SPLIT(@route_ids_csv, ',')
                WHERE TRY_CAST(value AS INT) IS NOT NULL
              )
            )
          )
        )
    )
  `;
}

async function assertCustomerInScope(companyId: number, userId: number, customerId: number): Promise<void> {
  const pool = await getPool();
  const scope = await resolveUserScope(companyId, userId);

  const result = await pool
    .request()
    .input("company_id", sql.Int, companyId)
    .input("customer_id", sql.Int, customerId)
    .input("scope_type", sql.VarChar(10), scope.scopeType)
    .input("branch_ids_csv", sql.VarChar(sql.MAX), scope.branchIdsCsv)
    .input("route_ids_csv", sql.VarChar(sql.MAX), scope.routeIdsCsv)
    .query(`
      SELECT 1
      FROM crm.customers c
      WHERE c.company_id = @company_id
        AND c.customer_id = @customer_id
        AND (
          @scope_type = 'ALL'
          OR (
            c.branch_id IN (
              SELECT TRY_CAST(value AS INT)
              FROM STRING_SPLIT(@branch_ids_csv, ',')
              WHERE TRY_CAST(value AS INT) IS NOT NULL
            )
            AND (
              @scope_type = 'BRANCH'
              OR c.route_id IN (
                SELECT TRY_CAST(value AS INT)
                FROM STRING_SPLIT(@route_ids_csv, ',')
                WHERE TRY_CAST(value AS INT) IS NOT NULL
              )
            )
          )
        );
    `);

  if (!result.recordset[0]) {
    throw new HttpError(403, "No tiene acceso a este cliente");
  }
}

export async function listActivities(companyId: number, userId: number, input: ActivitiesListInput) {
  const pool = await getPool();
  const scope = await resolveUserScope(companyId, userId);
  const page = Math.max(1, input.NPAG || 1);
  const pageSize = input.TPAG && input.TPAG > 0 ? input.TPAG : 20;
  const offset = (page - 1) * pageSize;

  const whereCustomer = input.CUSTOMER_ID ? "AND a.customer_id = @customer_id" : "";
  const whereStatus = input.STATUS ? "AND a.status = @status" : "";
  const whereType = input.TYPE ? "AND a.activity_type_code = @type" : "";
  const whereSearch = input.SEARCH ? "AND (a.subject LIKE @search OR a.notes LIKE @search)" : "";

  const scopeSql = buildScopeConditionSql("a");

  const countResult = await pool
    .request()
    .input("company_id", sql.Int, companyId)
    .input("scope_type", sql.VarChar(10), scope.scopeType)
    .input("branch_ids_csv", sql.VarChar(sql.MAX), scope.branchIdsCsv)
    .input("route_ids_csv", sql.VarChar(sql.MAX), scope.routeIdsCsv)
    .input("customer_id", sql.Int, input.CUSTOMER_ID ?? null)
    .input("status", sql.VarChar(20), input.STATUS || "")
    .input("type", sql.VarChar(20), input.TYPE || "")
    .input("search", sql.NVarChar(200), input.SEARCH ? `%${input.SEARCH}%` : "")
    .query<{ total: number }>(`
      SELECT COUNT(1) AS total
      FROM crm.activities a
      WHERE a.company_id = @company_id
        AND ${scopeSql}
        ${whereCustomer}
        ${whereStatus}
        ${whereType}
        ${whereSearch};
    `);

  const total = countResult.recordset[0]?.total ?? 0;
  const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(total / pageSize)) : 1;

  const dataResult = await pool
    .request()
    .input("company_id", sql.Int, companyId)
    .input("scope_type", sql.VarChar(10), scope.scopeType)
    .input("branch_ids_csv", sql.VarChar(sql.MAX), scope.branchIdsCsv)
    .input("route_ids_csv", sql.VarChar(sql.MAX), scope.routeIdsCsv)
    .input("customer_id", sql.Int, input.CUSTOMER_ID ?? null)
    .input("status", sql.VarChar(20), input.STATUS || "")
    .input("type", sql.VarChar(20), input.TYPE || "")
    .input("search", sql.NVarChar(200), input.SEARCH ? `%${input.SEARCH}%` : "")
    .input("offset", sql.Int, offset)
    .input("page_size", sql.Int, pageSize)
    .query(`
      SELECT
        a.activity_id AS ACTIVITYID,
        a.customer_id AS CUSTOMER_ID,
        c.customer_name AS NOMBRECLI,
        a.contact_id AS CONTACT_ID,
        ct.first_name + ' ' + ct.last_name AS CONTACT_NAME,
        a.opportunity_id AS OPPORTUNITY_ID,
        a.activity_type_code AS TYPE,
        aty.activity_type_name AS TYPE_NAME,
        a.subject AS SUBJECT,
        a.notes AS NOTES,
        a.due_at AS DUE_AT,
        a.completed_at AS COMPLETED_AT,
        a.status AS STATUS,
        a.priority_code AS PRIORITY,
        pl.priority_name AS PRIORITY_NAME,
        a.owner_user_id AS OWNER_ID,
        u.display_name AS OWNER_NAME,
        a.created_at AS CREATED_AT
      FROM crm.activities a
      INNER JOIN crm.customers c ON c.company_id = a.company_id AND c.customer_id = a.customer_id
      LEFT JOIN crm.contacts ct ON ct.company_id = a.company_id AND ct.contact_id = a.contact_id
      INNER JOIN cat.activity_types aty ON aty.activity_type_code = a.activity_type_code
      INNER JOIN cat.priority_levels pl ON pl.priority_code = a.priority_code
      LEFT JOIN sec.users u ON u.company_id = a.company_id AND u.user_id = a.owner_user_id
      WHERE a.company_id = @company_id
        AND ${scopeSql}
        ${whereCustomer}
        ${whereStatus}
        ${whereType}
        ${whereSearch}
      ORDER BY
        CASE a.status WHEN 'Pendiente' THEN 1 WHEN 'Programada' THEN 2 WHEN 'Completada' THEN 3 WHEN 'Cancelada' THEN 4 END,
        a.due_at ASC,
        a.created_at DESC
      OFFSET @offset ROWS FETCH NEXT @page_size ROWS ONLY;
    `);

  return {
    data: dataResult.recordset,
    tot_pags: totalPages,
    total_regs: total,
  };
}

export async function createActivity(companyId: number, userId: number, input: ActivityCreateInput): Promise<string> {
  const pool = await getPool();

  await assertCustomerInScope(companyId, userId, input.CUSTOMER_ID);

  await pool
    .request()
    .input("company_id", sql.Int, companyId)
    .input("customer_id", sql.Int, input.CUSTOMER_ID)
    .input("contact_id", sql.Int, input.CONTACT_ID ?? null)
    .input("opportunity_id", sql.Int, input.OPPORTUNITY_ID ?? null)
    .input("owner_user_id", sql.Int, userId)
    .input("activity_type_code", sql.VarChar(20), input.TYPE)
    .input("subject", sql.NVarChar(200), input.SUBJECT)
    .input("notes", sql.NVarChar(1000), input.NOTES || "")
    .input("due_at", sql.DateTime2, input.DUE_AT ? new Date(input.DUE_AT) : null)
    .input("status", sql.VarChar(20), "Pendiente")
    .input("priority_code", sql.VarChar(10), input.PRIORITY)
    .query(`
      INSERT INTO crm.activities (
        company_id, customer_id, contact_id, opportunity_id, owner_user_id,
        activity_type_code, subject, notes, due_at, status, priority_code
      ) VALUES (
        @company_id, @customer_id, @contact_id, @opportunity_id, @owner_user_id,
        @activity_type_code, @subject, @notes, @due_at, @status, @priority_code
      );
    `);

  return "Actividad creada correctamente";
}

export async function updateActivity(companyId: number, userId: number, input: ActivityUpdateInput): Promise<string> {
  const pool = await getPool();

  const existing = await pool
    .request()
    .input("company_id", sql.Int, companyId)
    .input("activity_id", sql.Int, input.ACTIVITY_ID)
    .query<{ customer_id: number }>(`
      SELECT customer_id
      FROM crm.activities
      WHERE company_id = @company_id AND activity_id = @activity_id;
    `);

  if (!existing.recordset[0]) {
    throw new HttpError(404, "Actividad no encontrada");
  }

  await assertCustomerInScope(companyId, userId, existing.recordset[0].customer_id);

  await pool
    .request()
    .input("company_id", sql.Int, companyId)
    .input("activity_id", sql.Int, input.ACTIVITY_ID)
    .input("contact_id", sql.Int, input.CONTACT_ID ?? null)
    .input("opportunity_id", sql.Int, input.OPPORTUNITY_ID ?? null)
    .input("activity_type_code", sql.VarChar(20), input.TYPE)
    .input("subject", sql.NVarChar(200), input.SUBJECT)
    .input("notes", sql.NVarChar(1000), input.NOTES || "")
    .input("due_at", sql.DateTime2, input.DUE_AT ? new Date(input.DUE_AT) : null)
    .input("priority_code", sql.VarChar(10), input.PRIORITY)
    .query(`
      UPDATE crm.activities
         SET contact_id = @contact_id,
             opportunity_id = @opportunity_id,
             activity_type_code = @activity_type_code,
             subject = @subject,
             notes = @notes,
             due_at = @due_at,
             priority_code = @priority_code,
             updated_at = SYSUTCDATETIME()
       WHERE company_id = @company_id
         AND activity_id = @activity_id;
    `);

  return "Actividad actualizada correctamente";
}

export async function completeActivity(companyId: number, userId: number, input: ActivityCompleteInput): Promise<string> {
  const pool = await getPool();

  const existing = await pool
    .request()
    .input("company_id", sql.Int, companyId)
    .input("activity_id", sql.Int, input.ACTIVITY_ID)
    .query<{ customer_id: number }>(`
      SELECT customer_id
      FROM crm.activities
      WHERE company_id = @company_id AND activity_id = @activity_id;
    `);

  if (!existing.recordset[0]) {
    throw new HttpError(404, "Actividad no encontrada");
  }

  await assertCustomerInScope(companyId, userId, existing.recordset[0].customer_id);

  const completedAt = input.STATUS === "Completada" ? "SYSUTCDATETIME()" : "NULL";

  await pool
    .request()
    .input("company_id", sql.Int, companyId)
    .input("activity_id", sql.Int, input.ACTIVITY_ID)
    .input("status", sql.VarChar(20), input.STATUS)
    .query(`
      UPDATE crm.activities
         SET status = @status,
             completed_at = ${completedAt},
             updated_at = SYSUTCDATETIME()
       WHERE company_id = @company_id
         AND activity_id = @activity_id;
    `);

  return input.STATUS === "Completada"
    ? "Actividad marcada como completada"
    : "Actividad cancelada correctamente";
}

export async function getActivityTypes() {
  const pool = await getPool();

  const result = await pool.query(`
    SELECT activity_type_code AS CODE, activity_type_name AS NAME
    FROM cat.activity_types
    WHERE is_active = 1
    ORDER BY activity_type_name;
  `);

  return result.recordset;
}
