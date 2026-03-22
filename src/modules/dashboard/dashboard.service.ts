import { getPool, sql } from "../../db/sqlserver";
import { resolveUserScope } from "../scope/scope.service";

const SALES_GOAL_MONTH = 1000000;

function scopeSql(alias: string): string {
  return `
    (
      @scope_type = 'ALL'
      OR (
        ${alias}.branch_id IN (
          SELECT TRY_CAST(value AS INT)
          FROM STRING_SPLIT(@branch_ids_csv, ',')
          WHERE TRY_CAST(value AS INT) IS NOT NULL
        )
        AND (
          @scope_type = 'BRANCH'
          OR ${alias}.route_id IN (
            SELECT TRY_CAST(value AS INT)
            FROM STRING_SPLIT(@route_ids_csv, ',')
            WHERE TRY_CAST(value AS INT) IS NOT NULL
          )
        )
      )
    )
  `;
}

function monthKeysLastSixMonths(): string[] {
  const now = new Date();
  const keys: string[] = [];
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    keys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}

function monthLabelFromKey(key: string): string {
  const [year, month] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, (month || 1) - 1, 1));
  return date.toLocaleDateString("es-MX", { month: "short" }).replace(".", "").toUpperCase();
}

function pctDelta(current: number, previous: number): number {
  if (previous <= 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

export async function getHomeDashboardData(companyId: number, userId: number) {
  const pool = await getPool();
  const scope = await resolveUserScope(companyId, userId);

  const requestBase = () =>
    pool
      .request()
      .input("company_id", sql.Int, companyId)
      .input("scope_type", sql.VarChar(10), scope.scopeType)
      .input("branch_ids_csv", sql.VarChar(sql.MAX), scope.branchIdsCsv)
      .input("route_ids_csv", sql.VarChar(sql.MAX), scope.routeIdsCsv);

  const [kpiRes, trendRes, statusRes, activitiesStatusRes, opportunitiesRes, recentActivitiesRes] =
    await Promise.all([
      requestBase().query<{
        sales_current: number;
        sales_previous: number;
        won_current: number;
        won_previous: number;
        new_clients_current: number;
        new_clients_previous: number;
      }>(`
        DECLARE @start_current_month DATE = DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1);
        DECLARE @start_previous_month DATE = DATEADD(MONTH, -1, @start_current_month);
        DECLARE @start_next_month DATE = DATEADD(MONTH, 1, @start_current_month);

        SELECT
          ISNULL(SUM(CASE
            WHEN o.status = 'ganada' AND o.close_date >= @start_current_month AND o.close_date < @start_next_month
            THEN o.amount ELSE 0 END), 0) AS sales_current,
          ISNULL(SUM(CASE
            WHEN o.status = 'ganada' AND o.close_date >= @start_previous_month AND o.close_date < @start_current_month
            THEN o.amount ELSE 0 END), 0) AS sales_previous,
          ISNULL(SUM(CASE
            WHEN o.status = 'ganada' AND o.close_date >= @start_current_month AND o.close_date < @start_next_month
            THEN 1 ELSE 0 END), 0) AS won_current,
          ISNULL(SUM(CASE
            WHEN o.status = 'ganada' AND o.close_date >= @start_previous_month AND o.close_date < @start_current_month
            THEN 1 ELSE 0 END), 0) AS won_previous,
          (
            SELECT COUNT(1)
            FROM crm.customers c
            WHERE c.company_id = @company_id
              AND c.customer_type = 'CLIENTE'
              AND c.created_at >= @start_current_month
              AND c.created_at < @start_next_month
              AND ${scopeSql("c")}
          ) AS new_clients_current,
          (
            SELECT COUNT(1)
            FROM crm.customers c
            WHERE c.company_id = @company_id
              AND c.customer_type = 'CLIENTE'
              AND c.created_at >= @start_previous_month
              AND c.created_at < @start_current_month
              AND ${scopeSql("c")}
          ) AS new_clients_previous
        FROM crm.opportunities o
        INNER JOIN crm.customers c ON c.company_id = o.company_id AND c.customer_id = o.customer_id
        WHERE o.company_id = @company_id
          AND ${scopeSql("c")};
      `),
      requestBase().query<{ month_key: string; total_sales: number }>(`
        DECLARE @start_month DATE = DATEADD(MONTH, -5, DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1));
        SELECT
          CONCAT(YEAR(o.close_date), '-', RIGHT('00' + CAST(MONTH(o.close_date) AS VARCHAR(2)), 2)) AS month_key,
          ISNULL(SUM(ISNULL(o.amount, 0)), 0) AS total_sales
        FROM crm.opportunities o
        INNER JOIN crm.customers c ON c.company_id = o.company_id AND c.customer_id = o.customer_id
        WHERE o.company_id = @company_id
          AND o.status = 'ganada'
          AND o.close_date >= @start_month
          AND ${scopeSql("c")}
        GROUP BY YEAR(o.close_date), MONTH(o.close_date)
        ORDER BY YEAR(o.close_date), MONTH(o.close_date);
      `),
      requestBase().query<{ status: string; total: number }>(`
        SELECT o.status, COUNT(1) AS total
        FROM crm.opportunities o
        INNER JOIN crm.customers c ON c.company_id = o.company_id AND c.customer_id = o.customer_id
        WHERE o.company_id = @company_id
          AND ${scopeSql("c")}
        GROUP BY o.status;
      `),
      requestBase().query<{ status: string; total: number }>(`
        SELECT a.status, COUNT(1) AS total
        FROM crm.activities a
        INNER JOIN crm.customers c ON c.company_id = a.company_id AND c.customer_id = a.customer_id
        WHERE a.company_id = @company_id
          AND ${scopeSql("c")}
        GROUP BY a.status;
      `),
      requestBase().query<{
        opportunity_id: number;
        cliente: string;
        producto: string;
        valor: number;
        etapa: string;
        progreso: number | null;
      }>(`
        SELECT TOP 8
          o.opportunity_id,
          c.customer_name AS cliente,
          COALESCE(oi.item_description, o.title) AS producto,
          ISNULL(o.amount, 0) AS valor,
          COALESCE(ps.stage_name, o.status) AS etapa,
          ISNULL(o.probability_pct, ps.default_probability_pct) AS progreso
        FROM crm.opportunities o
        INNER JOIN crm.customers c ON c.company_id = o.company_id AND c.customer_id = o.customer_id
        LEFT JOIN crm.pipeline_stages ps ON ps.company_id = o.company_id AND ps.stage_id = o.stage_id
        OUTER APPLY (
          SELECT TOP 1 item_description
          FROM crm.opportunity_items oi
          WHERE oi.company_id = o.company_id
            AND oi.opportunity_id = o.opportunity_id
        ) oi
        WHERE o.company_id = @company_id
          AND ${scopeSql("c")}
        ORDER BY o.updated_at DESC, o.created_at DESC;
      `),
      requestBase().query<{
        activity_type_code: string;
        status: string;
        subject: string;
        customer_name: string;
        created_at: Date;
      }>(`
        SELECT TOP 8
          a.activity_type_code,
          a.status,
          a.subject,
          c.customer_name,
          a.created_at
        FROM crm.activities a
        INNER JOIN crm.customers c ON c.company_id = a.company_id AND c.customer_id = a.customer_id
        WHERE a.company_id = @company_id
          AND ${scopeSql("c")}
        ORDER BY a.created_at DESC;
      `),
    ]);

  const kpi = kpiRes.recordset[0] || {
    sales_current: 0,
    sales_previous: 0,
    won_current: 0,
    won_previous: 0,
    new_clients_current: 0,
    new_clients_previous: 0,
  };

  const monthKeys = monthKeysLastSixMonths();
  const trendMap = new Map(trendRes.recordset.map((row) => [row.month_key, Number(row.total_sales || 0)]));
  const trendLabels = monthKeys.map(monthLabelFromKey);
  const trendValues = monthKeys.map((key) => Number(trendMap.get(key) || 0));

  const oppStatusOrder = ["abierta", "ganada", "perdida"];
  const oppStatusMap = new Map(statusRes.recordset.map((row) => [row.status, Number(row.total || 0)]));
  const oppStatusLabels = oppStatusOrder;
  const oppStatusValues = oppStatusOrder.map((key) => Number(oppStatusMap.get(key) || 0));

  const actStatusOrder = ["Pendiente", "Programada", "Completada", "Cancelada"];
  const actStatusMap = new Map(activitiesStatusRes.recordset.map((row) => [row.status, Number(row.total || 0)]));
  const actStatusLabels = actStatusOrder;
  const actStatusValues = actStatusOrder.map((key) => Number(actStatusMap.get(key) || 0));

  const salesCurrent = Number(kpi.sales_current || 0);
  const salesPrevious = Number(kpi.sales_previous || 0);
  const salesPctDelta = pctDelta(salesCurrent, salesPrevious);

  const wonCurrent = Number(kpi.won_current || 0);
  const wonPrevious = Number(kpi.won_previous || 0);
  const wonDelta = wonCurrent - wonPrevious;

  const newClientsCurrent = Number(kpi.new_clients_current || 0);
  const newClientsPrevious = Number(kpi.new_clients_previous || 0);
  const newClientsPctDelta = pctDelta(newClientsCurrent, newClientsPrevious);

  const salesGoalPct = SALES_GOAL_MONTH > 0 ? Math.min(100, (salesCurrent / SALES_GOAL_MONTH) * 100) : 0;
  const salesGoalRemaining = Math.max(0, SALES_GOAL_MONTH - salesCurrent);

  const opportunities = opportunitiesRes.recordset.map((row) => ({
    cliente: row.cliente,
    producto: row.producto,
    valor: Number(row.valor || 0),
    etapa: row.etapa,
    progreso: Math.max(0, Math.min(100, Math.round(Number(row.progreso || 0)))),
  }));

  const recentActivities = recentActivitiesRes.recordset.map((row) => ({
    activity_type_code: row.activity_type_code,
    status: row.status,
    titulo: row.subject,
    descripcion: row.customer_name,
    fecha: new Date(row.created_at).toISOString(),
  }));

  return {
    cards: {
      salesCurrent,
      salesGoalPct,
      salesGoalRemaining,
      wonCurrent,
      wonDelta,
      newClientsCurrent,
      newClientsPctDelta,
      salesPctDelta,
    },
    charts: {
      salesTrend: {
        labels: trendLabels,
        values: trendValues,
      },
      opportunitiesStatus: {
        labels: oppStatusLabels,
        values: oppStatusValues,
      },
      activitiesStatus: {
        labels: actStatusLabels,
        values: actStatusValues,
      },
    },
    opportunities,
    recentActivities,
    generated_at: new Date().toISOString(),
  };
}

export async function getOverdueActivities(companyId: number, userId: number) {
  const pool = await getPool();
  const scope = await resolveUserScope(companyId, userId);

  const result = await pool
    .request()
    .input("company_id", sql.Int, companyId)
    .input("scope_type", sql.VarChar(10), scope.scopeType)
    .input("branch_ids_csv", sql.VarChar(sql.MAX), scope.branchIdsCsv)
    .input("route_ids_csv", sql.VarChar(sql.MAX), scope.routeIdsCsv)
    .query<{
      activity_id: number;
      subject: string;
      customer_name: string;
      due_at: Date;
      activity_type_code: string;
      days_overdue: number;
    }>(`
      SELECT TOP 10
        a.activity_id,
        a.subject,
        c.customer_name,
        a.due_at,
        a.activity_type_code,
        DATEDIFF(DAY, a.due_at, SYSUTCDATETIME()) AS days_overdue
      FROM crm.activities a
      INNER JOIN crm.customers c ON c.company_id = a.company_id AND c.customer_id = a.customer_id
      WHERE a.company_id = @company_id
        AND a.status IN ('Pendiente', 'Programada')
        AND a.due_at IS NOT NULL
        AND a.due_at < SYSUTCDATETIME()
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
        )
      ORDER BY a.due_at ASC;
    `);

  return {
    count: result.recordset.length,
    items: result.recordset,
  };
}
