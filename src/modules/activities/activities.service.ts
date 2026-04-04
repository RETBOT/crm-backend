import { getPool, sql } from "../../db/sqlserver";
import { HttpError } from "../../shared/http-error";
import { resolveUserScope } from "../scope/scope.service";
import { createAssignedNotification } from "../notifications/notifications.service";
import {
  ActivitiesListInput,
  ActivityCompleteInput,
  ActivityCreateInput,
  ActivityUpdateInput,
  ActivityCheckinsListInput,
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
  const whereStatus = input.STATUS === "VENCIDA"
    ? "AND a.status IN ('Pendiente','Programada') AND a.due_at IS NOT NULL AND a.due_at < SYSUTCDATETIME()"
    : input.STATUS ? "AND a.status = @status" : "";
  const whereType = input.TYPE ? "AND a.activity_type_code = @type" : "";
  const whereSearch = input.SEARCH ? "AND (a.subject LIKE @search OR a.notes LIKE @search)" : "";
  const wherePriority = input.PRIORITY ? "AND a.priority_code = @priority" : "";
  const whereOwner = input.OWNER_USER_ID ? "AND a.owner_user_id = @owner_id" : "";
  const whereDueFrom = input.DUE_FROM ? "AND a.due_at >= @due_from" : "";
  const whereDueTo = input.DUE_TO ? "AND a.due_at <= @due_to" : "";

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
    .input("priority", sql.VarChar(20), input.PRIORITY || "")
    .input("owner_id", sql.Int, input.OWNER_USER_ID ?? null)
    .input("due_from", sql.DateTime2, input.DUE_FROM && input.DUE_FROM.trim() ? new Date(input.DUE_FROM + "T00:00:00") : null)
    .input("due_to", sql.DateTime2, input.DUE_TO && input.DUE_TO.trim() ? new Date(input.DUE_TO + "T23:59:59") : null)
    .query<{ total: number }>(`
      SELECT COUNT(1) AS total
      FROM crm.activities a
      WHERE a.company_id = @company_id
        AND ${scopeSql}
        ${whereCustomer}
        ${whereStatus}
        ${whereType}
        ${whereSearch}
        ${wherePriority}
        ${whereOwner}
        ${whereDueFrom}
        ${whereDueTo};
    `);

  const total = countResult.recordset[0]?.total ?? 0;
  const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(total / pageSize)) : 1;

  const sortBy = input.SORT_BY || "status";
  const sortDir = input.SORT_DIR || "ASC";

  const orderBy = `
    ORDER BY
      CASE @sort_by
        WHEN 'due_at' THEN CONVERT(varchar(20), a.due_at, 120)
        WHEN 'priority' THEN CASE a.priority_code WHEN 'Alta' THEN '1' WHEN 'Media' THEN '2' WHEN 'Baja' THEN '3' ELSE '4' END
        WHEN 'status' THEN CASE a.status WHEN 'Pendiente' THEN '1' WHEN 'Programada' THEN '2' WHEN 'Completada' THEN '3' WHEN 'Cancelada' THEN '4' ELSE '5' END
        WHEN 'created_at' THEN CONVERT(varchar(20), a.created_at, 120)
        ELSE CASE a.status WHEN 'Pendiente' THEN '1' WHEN 'Programada' THEN '2' WHEN 'Completada' THEN '3' WHEN 'Cancelada' THEN '4' ELSE '5' END
      END ${sortDir === "DESC" ? "DESC" : "ASC"},
      a.created_at DESC
  `;

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
    .input("priority", sql.VarChar(20), input.PRIORITY || "")
    .input("owner_id", sql.Int, input.OWNER_USER_ID ?? null)
    .input("due_from", sql.DateTime2, input.DUE_FROM && input.DUE_FROM.trim() ? new Date(input.DUE_FROM + "T00:00:00") : null)
    .input("due_to", sql.DateTime2, input.DUE_TO && input.DUE_TO.trim() ? new Date(input.DUE_TO + "T23:59:59") : null)
    .input("sort_by", sql.VarChar(20), sortBy)
    .input("sort_dir", sql.VarChar(4), sortDir)
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
        ${wherePriority}
        ${whereOwner}
        ${whereDueFrom}
        ${whereDueTo}
      ${orderBy}
      OFFSET @offset ROWS FETCH NEXT @page_size ROWS ONLY;
    `);

  return {
    data: dataResult.recordset,
    tot_pags: totalPages,
    total_regs: total,
  };
}

export async function createActivity(companyId: number, userId: number, input: ActivityCreateInput, canAssign: boolean): Promise<string> {
  const pool = await getPool();

  await assertCustomerInScope(companyId, userId, input.CUSTOMER_ID);

  const ownerId = canAssign && input.OWNER_USER_ID ? input.OWNER_USER_ID : userId;

  if (canAssign && input.OWNER_USER_ID) {
    const userCheck = await pool
      .request()
      .input("company_id", sql.Int, companyId)
      .input("user_id", sql.Int, input.OWNER_USER_ID)
      .query<{ user_id: number }>(`
        SELECT user_id FROM sec.users
        WHERE company_id = @company_id AND user_id = @user_id AND is_active = 1;
      `);

    if (!userCheck.recordset[0]) {
      throw new HttpError(400, "El usuario asignado no existe o esta inactivo");
    }
  }

  const insertResult = await pool
    .request()
    .input("company_id", sql.Int, companyId)
    .input("customer_id", sql.Int, input.CUSTOMER_ID)
    .input("contact_id", sql.Int, input.CONTACT_ID ?? null)
    .input("opportunity_id", sql.Int, input.OPPORTUNITY_ID ?? null)
    .input("owner_user_id", sql.Int, ownerId)
    .input("activity_type_code", sql.VarChar(20), input.TYPE)
    .input("subject", sql.NVarChar(200), input.SUBJECT)
    .input("notes", sql.NVarChar(1000), input.NOTES || "")
    .input("due_at", sql.DateTime2, input.DUE_AT ? new Date(input.DUE_AT) : null)
    .input("status", sql.VarChar(20), input.DUE_AT ? "Programada" : "Pendiente")
    .input("priority_code", sql.VarChar(10), input.PRIORITY)
    .query<{ activity_id: number }>(`
      INSERT INTO crm.activities (
        company_id, customer_id, contact_id, opportunity_id, owner_user_id,
        activity_type_code, subject, notes, due_at, status, priority_code
      ) OUTPUT INSERTED.activity_id VALUES (
        @company_id, @customer_id, @contact_id, @opportunity_id, @owner_user_id,
        @activity_type_code, @subject, @notes, @due_at, @status, @priority_code
      );
    `);

  const newActivityId = insertResult.recordset[0].activity_id;

  if (ownerId !== userId) {
    const creatorResult = await pool
      .request()
      .input("company_id", sql.Int, companyId)
      .input("user_id", sql.Int, userId)
      .query<{ display_name: string }>(`
        SELECT display_name FROM sec.users WHERE company_id = @company_id AND user_id = @user_id;
      `);

    const creatorName = creatorResult.recordset[0]?.display_name || "Un usuario";

    try {
      await createAssignedNotification(companyId, ownerId, newActivityId, input.SUBJECT, creatorName);
    } catch {
      // no bloquear la creacion si falla la notificacion
    }
  }

  return "Actividad creada correctamente";
}

export async function updateActivity(companyId: number, userId: number, input: ActivityUpdateInput): Promise<string> {
  const pool = await getPool();

  const existing = await pool
    .request()
    .input("company_id", sql.Int, companyId)
    .input("activity_id", sql.Int, input.ACTIVITY_ID)
    .query<{ customer_id: number; status: string }>(`
      SELECT customer_id, status
      FROM crm.activities
      WHERE company_id = @company_id AND activity_id = @activity_id;
    `);

  if (!existing.recordset[0]) {
    throw new HttpError(404, "Actividad no encontrada");
  }

  await assertCustomerInScope(companyId, userId, existing.recordset[0].customer_id);

  const currentStatus = existing.recordset[0].status;
  const isActive = currentStatus === "Pendiente" || currentStatus === "Programada";
  const newStatus = isActive ? (input.DUE_AT ? "Programada" : "Pendiente") : currentStatus;

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
    .input("status", sql.VarChar(20), newStatus)
    .query(`
      UPDATE crm.activities
         SET contact_id = @contact_id,
             opportunity_id = @opportunity_id,
             activity_type_code = @activity_type_code,
             subject = @subject,
             notes = @notes,
             due_at = @due_at,
             priority_code = @priority_code,
             status = @status,
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
  const hasCheckIn = input.STATUS === "Completada" && input.CHECK_IN_LAT != null && input.CHECK_IN_LON != null;

  if (input.STATUS === "Completada") {
    const actType = await pool
      .request()
      .input("company_id", sql.Int, companyId)
      .input("activity_id", sql.Int, input.ACTIVITY_ID)
      .query<{ activity_type_code: string }>(`
        SELECT activity_type_code FROM crm.activities
        WHERE company_id = @company_id AND activity_id = @activity_id;
      `);

    const activityType = actType.recordset[0]?.activity_type_code;
    if ((activityType === "Visita" || activityType === "Reunion") && (!input.NOTES || input.NOTES.trim().length < 10)) {
      throw new HttpError(400, "Para visitas y reuniones, las notas deben tener al menos 10 caracteres");
    }
  }

  await pool
    .request()
    .input("company_id", sql.Int, companyId)
    .input("activity_id", sql.Int, input.ACTIVITY_ID)
    .input("status", sql.VarChar(20), input.STATUS)
    .input("check_in_lat", sql.Decimal(9, 6), hasCheckIn ? input.CHECK_IN_LAT : null)
    .input("check_in_lon", sql.Decimal(9, 6), hasCheckIn ? input.CHECK_IN_LON : null)
    .input("notes", sql.NVarChar(1000), input.NOTES || null)
    .query(`
      UPDATE crm.activities
         SET status = @status,
             completed_at = ${completedAt},
             check_in_lat = @check_in_lat,
             check_in_lon = @check_in_lon,
             notes = CASE
               WHEN @notes IS NOT NULL AND LEN(@notes) > 0 AND notes IS NOT NULL AND LEN(notes) > 0
                 THEN notes + CHAR(13) + CHAR(10) + CHAR(13) + CHAR(10) + '--- Check-in ---' + CHAR(13) + CHAR(10) + @notes
               WHEN @notes IS NOT NULL AND LEN(@notes) > 0
                 THEN @notes
               ELSE notes
             END,
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

export async function getUsersForAssignment(companyId: number, userId: number) {
  const pool = await getPool();
  const scope = await resolveUserScope(companyId, userId);

  const result = await pool
    .request()
    .input("company_id", sql.Int, companyId)
    .input("scope_type", sql.VarChar(10), scope.scopeType)
    .input("branch_ids_csv", sql.VarChar(sql.MAX), scope.branchIdsCsv)
    .input("route_ids_csv", sql.VarChar(sql.MAX), scope.routeIdsCsv)
    .query<{ user_id: number; display_name: string; branch_name: string }>(`
      SELECT DISTINCT
        u.user_id,
        u.display_name,
        b.branch_name
      FROM sec.users u
      LEFT JOIN crm.branches b ON b.company_id = u.company_id AND b.branch_id = u.default_branch_id
      WHERE u.company_id = @company_id
        AND u.is_active = 1
        AND (
          @scope_type = 'ALL'
          OR u.default_branch_id IN (
            SELECT TRY_CAST(value AS INT)
            FROM STRING_SPLIT(@branch_ids_csv, ',')
            WHERE TRY_CAST(value AS INT) IS NOT NULL
          )
        )
      ORDER BY u.display_name;
    `);

  return result.recordset;
}

export async function getActivityCheckins(companyId: number, userId: number, input: ActivityCheckinsListInput) {
  const pool = await getPool();
  const scope = await resolveUserScope(companyId, userId);

  const whereFrom = input.FROM_DATE ? "AND a.completed_at >= @from_date" : "";
  const whereTo = input.TO_DATE ? "AND a.completed_at <= @to_date" : "";
  const whereUser = input.USER_ID ? "AND a.owner_user_id = @user_id" : "";
  const whereType = input.TYPE ? "AND a.activity_type_code = @type" : "";

  const scopeSql = buildScopeConditionSql("a");

  const result = await pool
    .request()
    .input("company_id", sql.Int, companyId)
    .input("scope_type", sql.VarChar(10), scope.scopeType)
    .input("branch_ids_csv", sql.VarChar(sql.MAX), scope.branchIdsCsv)
    .input("route_ids_csv", sql.VarChar(sql.MAX), scope.routeIdsCsv)
    .input("from_date", sql.DateTime2, input.FROM_DATE ? new Date(input.FROM_DATE) : null)
    .input("to_date", sql.DateTime2, input.TO_DATE ? new Date(input.TO_DATE) : null)
    .input("user_id", sql.Int, input.USER_ID ?? null)
    .input("type", sql.VarChar(20), input.TYPE || null)
    .query(`
      SELECT
        a.activity_id AS ACTIVITYID,
        a.customer_id AS CUSTOMER_ID,
        c.customer_name AS NOMBRECLI,
        c.latitude AS CUSTOMER_LAT,
        c.longitude AS CUSTOMER_LON,
        a.activity_type_code AS TYPE,
        aty.activity_type_name AS TYPE_NAME,
        a.subject AS SUBJECT,
        a.notes AS NOTES,
        a.check_in_lat AS CHECK_IN_LAT,
        a.check_in_lon AS CHECK_IN_LON,
        a.completed_at AS COMPLETED_AT,
        a.owner_user_id AS OWNER_ID,
        u.display_name AS OWNER_NAME
      FROM crm.activities a
      INNER JOIN crm.customers c ON c.company_id = a.company_id AND c.customer_id = a.customer_id
      INNER JOIN cat.activity_types aty ON aty.activity_type_code = a.activity_type_code
      LEFT JOIN sec.users u ON u.company_id = a.company_id AND u.user_id = a.owner_user_id
      WHERE a.company_id = @company_id
        AND a.status = 'Completada'
        AND a.check_in_lat IS NOT NULL
        AND a.check_in_lon IS NOT NULL
        AND ${scopeSql}
        ${whereFrom}
        ${whereTo}
        ${whereUser}
        ${whereType}
      ORDER BY a.completed_at DESC;
    `);

  return result.recordset;
}
