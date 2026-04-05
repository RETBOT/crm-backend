import { getPool, sql } from "../../db/sqlserver";
import { resolveUserScope } from "../scope/scope.service";
import { ReportFilterInput } from "./reports.schemas";

// ============================================
// INTERFACES PARA TIPOS DE DATOS SQL
// ============================================

interface SalesTrendRow {
  month_key: string;
  total_sales: number;
  won_count: number;
}

interface OpportunityStatusRow {
  stage: string;
  total_amount: number;
  count: number;
}

interface ActivityStatusRow {
  status: string;
  activity_type_code: string;
  count: number;
}

interface TopSellerRow {
  seller_name: string;
  won_count: number;
  total_sales: number;
}

interface KpiRow {
  sales_current: number;
  sales_previous: number;
  won_current: number;
  won_previous: number;
  new_customers_current: number;
  new_customers_previous: number;
  activities_current: number;
  activities_previous: number;
}

interface SalesReportRow {
  period: string;
  seller_name: string;
  branch_name: string;
  total_sales: number;
  won_count: number;
  avg_probability: number;
  first_sale_date: Date;
  last_sale_date: Date;
}

interface NewCustomerRow {
  period: string;
  new_count: number;
  branch_name: string;
}

interface RecurrentCustomerRow {
  customer_id: number;
  customer_name: string;
  purchase_count: number;
  total_purchases: number;
  last_purchase_date: Date;
}

interface InactiveCustomerRow {
  customer_id: number;
  customer_name: string;
  last_purchase_date: Date;
  days_inactive: number;
}

interface CustomerSummaryRow {
  total_customers: number;
  total_prospects: number;
  active_last_3_months: number;
}

interface ActivityByStatusRow {
  status: string;
  activity_type_code: string;
  count: number;
  avg_days_to_complete: number;
}

interface ActivityBySellerRow {
  seller_name: string;
  status: string;
  count: number;
}

interface OverdueActivityRow {
  activity_id: number;
  subject: string;
  customer_name: string;
  activity_type_code: string;
  due_at: Date;
  days_overdue: number;
  assigned_to: string;
}

interface ActivityDailyTrendRow {
  activity_date: Date;
  activity_type_code: string;
  count: number;
}

interface OpportunityFunnelRow {
  stage: string;
  stage_order: number;
  count: number;
  total_amount: number;
  avg_probability: number;
}

interface OpportunityConversionRow {
  stage: string;
  stage_order: number;
  count: number;
  cumulative_count: number;
  stage_percentage: number;
}

interface OpportunityBySellerRow {
  seller_name: string;
  total_count: number;
  won_count: number;
  lost_count: number;
  open_count: number;
  won_amount: number;
  avg_days_to_close: number;
}

interface OpportunityByProductRow {
  product_name: string;
  opportunity_count: number;
  total_amount: number;
  won_amount: number;
}

interface OpportunitySummaryRow {
  total_opportunities: number;
  won_count: number;
  lost_count: number;
  open_count: number;
  won_amount: number;
  pipeline_amount: number;
  avg_days_to_close: number;
}

interface ProductSalesRow {
  product_id: number;
  product_name: string;
  category: string;
  total_quantity: number;
  total_sales: number;
  opportunity_count: number;
  avg_price: number;
}

interface CategorySalesRow {
  category: string;
  total_sales: number;
  product_count: number;
  opportunity_count: number;
}

interface TopProductRow {
  product_name: string;
  total_quantity: number;
}

interface SavedViewRow {
  view_id: number;
  report_type: string;
  view_name: string;
  filters: string;
  is_default: number;
  created_at: Date;
  updated_at: Date;
}

interface ScheduledReportRow {
  schedule_id: number;
  report_type: string;
  frequency: string;
  day_of_week: number | null;
  day_of_month: number | null;
  recipients: string;
  filters: string;
  next_run_at: Date;
  last_run_at: Date | null;
  is_active: number;
  created_at: Date;
  updated_at: Date;
}

// Función helper para construir condición de alcance
function scopeSql(alias: string): string {
  // Cuando scope_type = 'ALL', permitir ver todos los registros sin filtrar por branch/ruta
  return `
    (
      @scope_type = 'ALL'
      OR (
        ${alias}.branch_id IN (
          SELECT TRY_CAST(value AS INT)
          FROM STRING_SPLIT(@branch_ids_csv, ',')
          WHERE TRY_CAST(value AS INT) IS NOT NULL
          AND @branch_ids_csv != ''
        )
        AND (
          @scope_type = 'BRANCH'
          OR ${alias}.route_id IN (
            SELECT TRY_CAST(value AS INT)
            FROM STRING_SPLIT(@route_ids_csv, ',')
            WHERE TRY_CAST(value AS INT) IS NOT NULL
            AND @route_ids_csv != ''
          )
        )
      )
    )
  `;
}

// Función helper para construir parámetros base
function buildRequestParams(pool: any, companyId: number, scope: any) {
  const branchIdsCsv = scope.scopeType === 'ALL' ? '' : (scope.branchIdsCsv || '');
  const routeIdsCsv = scope.scopeType === 'ALL' ? '' : (scope.routeIdsCsv || '');
  
  return pool
    .request()
    .input("company_id", sql.Int, companyId)
    .input("scope_type", sql.VarChar(10), scope.scopeType)
    .input("branch_ids_csv", sql.VarChar(sql.MAX), branchIdsCsv)
    .input("route_ids_csv", sql.VarChar(sql.MAX), routeIdsCsv);
}

// Función helper para agregar filtros de fecha
function addDateFilters(request: any, filters: ReportFilterInput) {
  if (filters.START_DATE) {
    request.input("start_date", sql.Date, new Date(filters.START_DATE));
  } else {
    request.input("start_date", sql.Date, null);
  }
  if (filters.END_DATE) {
    request.input("end_date", sql.Date, new Date(filters.END_DATE));
  } else {
    request.input("end_date", sql.Date, null);
  }
  if (filters.STATUS) {
    request.input("status", sql.VarChar(20), filters.STATUS);
  } else {
    request.input("status", sql.VarChar(20), null);
  }
  if (filters.STAGE_IDS?.length > 0) {
    request.input("stage_ids_csv", sql.VarChar(sql.MAX), filters.STAGE_IDS.join(","));
  } else {
    request.input("stage_ids_csv", sql.VarChar(sql.MAX), null);
  }
  if (filters.MIN_AMOUNT) {
    request.input("min_amount", sql.Decimal(18,2), filters.MIN_AMOUNT);
  } else {
    request.input("min_amount", sql.Decimal(18,2), null);
  }
  if (filters.MAX_AMOUNT) {
    request.input("max_amount", sql.Decimal(18,2), filters.MAX_AMOUNT);
  } else {
    request.input("max_amount", sql.Decimal(18,2), null);
  }
  if (filters.SEARCH) {
    request.input("search", sql.VarChar(100), filters.SEARCH);
  } else {
    request.input("search", sql.VarChar(100), null);
  }
  return request;
}

// Función helper para calcular porcentaje de cambio
function pctChange(current: number, previous: number): number {
  if (previous <= 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

// ============================================
// DASHBOARD EJECUTIVO
// ============================================
export async function getDashboardExecutive(
  companyId: number,
  userId: number,
  filters: ReportFilterInput
) {
  const pool = await getPool();
  const scope = await resolveUserScope(companyId, userId);

  // Fechas por defecto: mes actual vs mes anterior
  const now = new Date();
  const startCurrentMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const startPreviousMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const startNextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  const startDate = filters.START_DATE ? new Date(filters.START_DATE) : startCurrentMonth;
  const endDate = filters.END_DATE ? new Date(filters.END_DATE) : startNextMonth;
  const compareStartDate = filters.COMPARE_START_DATE
    ? new Date(filters.COMPARE_START_DATE)
    : startPreviousMonth;
  const compareEndDate = filters.COMPARE_END_DATE
    ? new Date(filters.COMPARE_END_DATE)
    : startCurrentMonth;

  const requestBase = () =>
    buildRequestParams(pool, companyId, scope)
      .input("start_date", sql.Date, startDate)
      .input("end_date", sql.Date, endDate)
      .input("compare_start_date", sql.Date, compareStartDate)
      .input("compare_end_date", sql.Date, compareEndDate);

  // Ejecutar todas las queries en paralelo
  const [kpiRes, salesTrendRes, opportunitiesRes, activitiesRes, topSellersRes] =
    await Promise.all([
      // KPIs principales con comparativa
      requestBase().query(`
        DECLARE @sales_current DECIMAL(18,2) = 0;
        DECLARE @sales_previous DECIMAL(18,2) = 0;
        DECLARE @won_current INT = 0;
        DECLARE @won_previous INT = 0;
        DECLARE @new_customers_current INT = 0;
        DECLARE @new_customers_previous INT = 0;
        DECLARE @activities_current INT = 0;
        DECLARE @activities_previous INT = 0;

        -- Ventas del periodo actual
        SELECT @sales_current = ISNULL(SUM(amount), 0), @won_current = COUNT(*)
        FROM crm.opportunities o
        INNER JOIN crm.customers c ON c.company_id = o.company_id AND c.customer_id = o.customer_id
        WHERE o.company_id = @company_id
          AND o.status = 'ganada'
          AND o.close_date >= @start_date
          AND o.close_date < @end_date
          AND ${scopeSql("c")};

        -- Ventas del periodo anterior
        SELECT @sales_previous = ISNULL(SUM(amount), 0), @won_previous = COUNT(*)
        FROM crm.opportunities o
        INNER JOIN crm.customers c ON c.company_id = o.company_id AND c.customer_id = o.customer_id
        WHERE o.company_id = @company_id
          AND o.status = 'ganada'
          AND o.close_date >= @compare_start_date
          AND o.close_date < @compare_end_date
          AND ${scopeSql("c")};

        -- Clientes nuevos periodo actual
        SELECT @new_customers_current = COUNT(*)
        FROM crm.customers c
        WHERE c.company_id = @company_id
          AND c.customer_type = 'CLIENTE'
          AND c.created_at >= @start_date
          AND c.created_at < @end_date
          AND ${scopeSql("c")};

        -- Clientes nuevos periodo anterior
        SELECT @new_customers_previous = COUNT(*)
        FROM crm.customers c
        WHERE c.company_id = @company_id
          AND c.customer_type = 'CLIENTE'
          AND c.created_at >= @compare_start_date
          AND c.created_at < @compare_end_date
          AND ${scopeSql("c")};

        -- Actividades completadas periodo actual
        SELECT @activities_current = COUNT(*)
        FROM crm.activities a
        INNER JOIN crm.customers c ON c.company_id = a.company_id AND c.customer_id = a.customer_id
        WHERE a.company_id = @company_id
          AND a.status = 'Completada'
          AND a.completed_at >= @start_date
          AND a.completed_at < @end_date
          AND ${scopeSql("c")};

        -- Actividades completadas periodo anterior
        SELECT @activities_previous = COUNT(*)
        FROM crm.activities a
        INNER JOIN crm.customers c ON c.company_id = a.company_id AND c.customer_id = a.customer_id
        WHERE a.company_id = @company_id
          AND a.status = 'Completada'
          AND a.completed_at >= @compare_start_date
          AND a.completed_at < @compare_end_date
          AND ${scopeSql("c")};

        SELECT
          @sales_current AS sales_current,
          @sales_previous AS sales_previous,
          @won_current AS won_current,
          @won_previous AS won_previous,
          @new_customers_current AS new_customers_current,
          @new_customers_previous AS new_customers_previous,
          @activities_current AS activities_current,
          @activities_previous AS activities_previous;
      `),

      // Tendencia de ventas (últimos 6 meses)
      requestBase().query(`
        DECLARE @start_6months DATE = DATEADD(MONTH, -5, DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1));
        
        SELECT
          CONCAT(YEAR(o.close_date), '-', RIGHT('00' + CAST(MONTH(o.close_date) AS VARCHAR(2)), 2)) AS month_key,
          ISNULL(SUM(ISNULL(o.amount, 0)), 0) AS total_sales,
          COUNT(*) AS won_count
        FROM crm.opportunities o
        INNER JOIN crm.customers c ON c.company_id = o.company_id AND c.customer_id = o.customer_id
        WHERE o.company_id = @company_id
          AND o.status = 'ganada'
          AND o.close_date >= @start_6months
          AND ${scopeSql("c")}
        GROUP BY YEAR(o.close_date), MONTH(o.close_date)
        ORDER BY YEAR(o.close_date), MONTH(o.close_date);
      `),

      // Estado de oportunidades
      requestBase().query(`
        SELECT 
          COALESCE(ps.stage_name, o.status) AS stage,
          COUNT(*) AS count,
          SUM(ISNULL(o.amount, 0)) AS total_amount
        FROM crm.opportunities o
        INNER JOIN crm.customers c ON c.company_id = o.company_id AND c.customer_id = o.customer_id
        LEFT JOIN crm.pipeline_stages ps ON ps.company_id = o.company_id AND ps.stage_id = o.stage_id
        WHERE o.company_id = @company_id
          AND ${scopeSql("c")}
        GROUP BY COALESCE(ps.stage_name, o.status);
      `),

      // Estado de actividades
      requestBase().query(`
        SELECT 
          a.status,
          a.activity_type_code,
          COUNT(*) AS count
        FROM crm.activities a
        INNER JOIN crm.customers c ON c.company_id = a.company_id AND c.customer_id = a.customer_id
        WHERE a.company_id = @company_id
          AND ${scopeSql("c")}
        GROUP BY a.status, a.activity_type_code;
      `),

      // Top 5 vendedores
      requestBase().query(`
        SELECT TOP 5
          u.display_name AS seller_name,
          COUNT(o.opportunity_id) AS won_count,
          SUM(ISNULL(o.amount, 0)) AS total_sales
        FROM crm.opportunities o
        INNER JOIN crm.customers c ON c.company_id = o.company_id AND c.customer_id = o.customer_id
        LEFT JOIN sec.users u ON u.company_id = o.company_id AND u.user_id = o.owner_user_id
        WHERE o.company_id = @company_id
          AND o.status = 'ganada'
          AND o.close_date >= @start_date
          AND o.close_date < @end_date
          AND ${scopeSql("c")}
        GROUP BY u.display_name
        ORDER BY total_sales DESC;
      `),
    ]);

  const kpi = (kpiRes.recordset[0] as KpiRow) || {
    sales_current: 0,
    sales_previous: 0,
    won_current: 0,
    won_previous: 0,
    new_customers_current: 0,
    new_customers_previous: 0,
    activities_current: 0,
    activities_previous: 0,
  };

  // Procesar tendencia de ventas
  const salesTrend = (salesTrendRes.recordset as SalesTrendRow[]).map((row) => ({
    month: row.month_key,
    sales: Number(row.total_sales),
    count: Number(row.won_count),
  }));

  // Procesar estado de oportunidades
  const opportunitiesStatus = (opportunitiesRes.recordset as OpportunityStatusRow[]).map((row) => ({
    stage: row.stage,
    count: Number(row.count),
    amount: Number(row.total_amount),
  }));

  // Procesar estado de actividades
  const activitiesStatus = (activitiesRes.recordset as ActivityStatusRow[]).reduce(
    (acc: Record<string, number>, row: ActivityStatusRow) => {
      const key = row.status;
      if (!acc[key]) acc[key] = 0;
      acc[key] += Number(row.count);
      return acc;
    },
    {} as Record<string, number>
  );

  // Procesar top vendedores
  const topSellers = (topSellersRes.recordset as TopSellerRow[]).map((row) => ({
    name: row.seller_name,
    wonCount: Number(row.won_count),
    totalSales: Number(row.total_sales),
  }));

  return {
    kpi: {
      sales: {
        current: Number(kpi.sales_current),
        previous: Number(kpi.sales_previous),
        change: pctChange(Number(kpi.sales_current), Number(kpi.sales_previous)),
      },
      won: {
        current: Number(kpi.won_current),
        previous: Number(kpi.won_previous),
        change: pctChange(Number(kpi.won_current), Number(kpi.won_previous)),
      },
      newCustomers: {
        current: Number(kpi.new_customers_current),
        previous: Number(kpi.new_customers_previous),
        change: pctChange(
          Number(kpi.new_customers_current),
          Number(kpi.new_customers_previous)
        ),
      },
      activities: {
        current: Number(kpi.activities_current),
        previous: Number(kpi.activities_previous),
        change: pctChange(
          Number(kpi.activities_current),
          Number(kpi.activities_previous)
        ),
      },
    },
    charts: {
      salesTrend,
      opportunitiesStatus,
      activitiesStatus,
      topSellers,
    },
    generated_at: new Date().toISOString(),
  };
}

// ============================================
// REPORTE DE VENTAS
// ============================================
export async function getSalesReport(companyId: number, userId: number, filters: ReportFilterInput) {
  const pool = await getPool();
  const scope = await resolveUserScope(companyId, userId);

  let request = buildRequestParams(pool, companyId, scope);
  request = addDateFilters(request, filters);

  request.input("user_ids_csv", sql.VarChar(sql.MAX), 
    filters.USER_IDS?.length > 0 ? filters.USER_IDS.join(",") : null);

  const result = await request.query(`
    SELECT
      FORMAT(o.close_date, 'yyyy-MM') AS period,
      u.display_name AS seller_name,
      b.branch_name AS branch_name,
      SUM(ISNULL(o.amount, 0)) AS total_sales,
      COUNT(*) AS won_count,
      AVG(ISNULL(o.probability_pct, 0)) AS avg_probability,
      MIN(o.close_date) AS first_sale_date,
      MAX(o.close_date) AS last_sale_date
    FROM crm.opportunities o
    INNER JOIN crm.customers c ON c.company_id = o.company_id AND c.customer_id = o.customer_id
    LEFT JOIN sec.users u ON u.company_id = o.company_id AND u.user_id = o.owner_user_id
    LEFT JOIN crm.branches b ON b.company_id = c.company_id AND b.branch_id = c.branch_id
    WHERE o.company_id = @company_id
      AND o.status = 'ganada'
      AND (@start_date IS NULL OR o.close_date >= @start_date)
      AND (@end_date IS NULL OR o.close_date <= @end_date)
      AND (@status IS NULL OR o.status = @status)
      AND (@stage_ids_csv IS NULL OR o.stage_id IN (
        SELECT TRY_CAST(value AS INT) FROM STRING_SPLIT(@stage_ids_csv, ',')
      ))
      AND (@min_amount IS NULL OR o.amount >= @min_amount)
      AND (@max_amount IS NULL OR o.amount <= @max_amount)
      AND (@search IS NULL OR c.customer_name LIKE '%' + @search + '%')
      AND ${scopeSql("c")}
      AND (@user_ids_csv IS NULL OR u.user_id IN (
        SELECT TRY_CAST(value AS INT) FROM STRING_SPLIT(@user_ids_csv, ',')
      ))
    GROUP BY FORMAT(o.close_date, 'yyyy-MM'), u.display_name, b.branch_name
    ORDER BY period DESC, total_sales DESC;
  `);

  // Debug removed in production

  // Totales
  const totals = {
    totalSales: (result.recordset as SalesReportRow[]).reduce((sum: number, row: SalesReportRow) => sum + Number(row.total_sales), 0),
    totalWon: (result.recordset as SalesReportRow[]).reduce((sum: number, row: SalesReportRow) => sum + Number(row.won_count), 0),
    avgSaleAmount:
      result.recordset.length > 0
        ? (result.recordset as SalesReportRow[]).reduce((sum: number, row: SalesReportRow) => sum + Number(row.total_sales), 0) /
          (result.recordset as SalesReportRow[]).reduce((sum: number, row: SalesReportRow) => sum + Number(row.won_count), 0)
        : 0,
  };

  return {
    data: (result.recordset as SalesReportRow[]).map((row) => ({
      period: row.period,
      sellerName: row.seller_name,
      branchName: row.branch_name,
      totalSales: Number(row.total_sales),
      wonCount: Number(row.won_count),
      avgProbability: Number(row.avg_probability),
      firstSaleDate: row.first_sale_date,
      lastSaleDate: row.last_sale_date,
    })),
    totals,
  };
}

// ============================================
// REPORTE DE CLIENTES
// ============================================
export async function getCustomersReport(
  companyId: number,
  userId: number,
  filters: ReportFilterInput
) {
  const pool = await getPool();
  const scope = await resolveUserScope(companyId, userId);

  let request = buildRequestParams(pool, companyId, scope);
  request = addDateFilters(request, filters);

  // Clientes nuevos
  const newCustomersRes = await request.query(`
    SELECT
      FORMAT(c.created_at, 'yyyy-MM') AS period,
      COUNT(*) AS new_count,
      b.branch_name AS branch_name
    FROM crm.customers c
    LEFT JOIN crm.branches b ON b.company_id = c.company_id AND b.branch_id = c.branch_id
    WHERE c.company_id = @company_id
      AND c.customer_type = 'CLIENTE'
      AND (@start_date IS NULL OR c.created_at >= @start_date)
      AND (@end_date IS NULL OR c.created_at <= @end_date)
      AND ${scopeSql("c")}
    GROUP BY FORMAT(c.created_at, 'yyyy-MM'), b.branch_name
    ORDER BY period DESC;
  `);

  // Clientes recurrentes (con oportunidades ganadas)
  const recurrentCustomersRes = await request.query(`
    SELECT
      c.customer_id,
      c.customer_name,
      COUNT(o.opportunity_id) AS purchase_count,
      SUM(ISNULL(o.amount, 0)) AS total_purchases,
      MAX(o.close_date) AS last_purchase_date
    FROM crm.customers c
    INNER JOIN crm.opportunities o ON o.company_id = c.company_id AND o.customer_id = c.customer_id
    WHERE c.company_id = @company_id
      AND c.customer_type = 'CLIENTE'
      AND o.status = 'ganada'
      AND (@start_date IS NULL OR o.close_date >= @start_date)
      AND (@end_date IS NULL OR o.close_date <= @end_date)
      AND ${scopeSql("c")}
    GROUP BY c.customer_id, c.customer_name
    HAVING COUNT(o.opportunity_id) > 1
    ORDER BY total_purchases DESC;
  `);

  // Clientes inactivos (sin compras en los últimos X días)
  const inactiveDays = 90;
  const threeMonthsAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const inactiveCustomersResult = await pool
    .request()
    .input("company_id", sql.Int, companyId)
    .input("scope_type", sql.VarChar(10), scope.scopeType)
    .input("branch_ids_csv", sql.VarChar(sql.MAX), scope.branchIdsCsv)
    .input("route_ids_csv", sql.VarChar(sql.MAX), scope.routeIdsCsv)
    .input("inactive_days", sql.Int, inactiveDays)
    .input("three_months_ago", sql.Date, threeMonthsAgo)
    .query(`
      SELECT
        COUNT(DISTINCT CASE WHEN c.customer_type = 'CLIENTE' THEN c.customer_id END) AS total_customers,
        COUNT(DISTINCT CASE WHEN c.customer_type = 'PROSPECTO' THEN c.customer_id END) AS total_prospects,
        (SELECT COUNT(DISTINCT c2.customer_id)
         FROM crm.customers c2
         LEFT JOIN crm.routes r2 ON r2.company_id = c2.company_id AND r2.branch_id = c2.branch_id
         WHERE c2.company_id = @company_id
           AND c2.customer_type = 'CLIENTE'
           AND EXISTS (
             SELECT 1 FROM crm.opportunities o 
             WHERE o.company_id = c2.company_id 
               AND o.customer_id = c2.customer_id 
               AND o.status = 'ganada'
               AND o.close_date >= @three_months_ago
           )
           AND (
             @scope_type = 'ALL'
             OR (@branch_ids_csv = '' OR c2.branch_id IN (
               SELECT TRY_CAST(value AS INT) FROM STRING_SPLIT(@branch_ids_csv, ',')
               WHERE TRY_CAST(value AS INT) IS NOT NULL
             ))
           )
        ) AS active_last_3_months
      FROM crm.customers c
      WHERE c.company_id = @company_id
        AND (
          @scope_type = 'ALL'
          OR (@branch_ids_csv = '' OR c.branch_id IN (
            SELECT TRY_CAST(value AS INT) FROM STRING_SPLIT(@branch_ids_csv, ',')
            WHERE TRY_CAST(value AS INT) IS NOT NULL
          ))
        );
    `);

  const summary = (inactiveCustomersResult.recordset[0] as CustomerSummaryRow) || {
    total_customers: 0,
    total_prospects: 0,
    active_last_3_months: 0,
  };

  return {
    newCustomers: (newCustomersRes.recordset as NewCustomerRow[]).map((row) => ({
      period: row.period,
      count: Number(row.new_count),
      branchName: row.branch_name,
    })),
    recurrentCustomers: (recurrentCustomersRes.recordset as RecurrentCustomerRow[]).map((row) => ({
      customerId: row.customer_id,
      customerName: row.customer_name,
      purchaseCount: Number(row.purchase_count),
      totalPurchases: Number(row.total_purchases),
      lastPurchaseDate: row.last_purchase_date,
    })),
    summary: {
      totalCustomers: Number(summary.total_customers),
      totalProspects: Number(summary.total_prospects),
      activeLast3Months: Number(summary.active_last_3_months),
    },
  };
}

// ============================================
// REPORTE DE ACTIVIDADES
// ============================================
export async function getActivitiesReport(
  companyId: number,
  userId: number,
  filters: ReportFilterInput
) {
  const pool = await getPool();
  const scope = await resolveUserScope(companyId, userId);

  let request = buildRequestParams(pool, companyId, scope);
  request = addDateFilters(request, filters);

  // Actividades por estado y tipo
  const byStatusRes = await request.query(`
    SELECT
      a.status,
      a.activity_type_code,
      COUNT(*) AS count,
      AVG(DATEDIFF(DAY, a.created_at, ISNULL(a.completed_at, GETDATE()))) AS avg_days_to_complete
    FROM crm.activities a
    INNER JOIN crm.customers c ON c.company_id = a.company_id AND c.customer_id = a.customer_id
    WHERE a.company_id = @company_id
      AND (@start_date IS NULL OR a.created_at >= @start_date)
      AND (@end_date IS NULL OR a.created_at <= @end_date)
      AND ${scopeSql("c")}
    GROUP BY a.status, a.activity_type_code
    ORDER BY count DESC;
  `);

  // Actividades por vendedor
  const bySellerRes = await request.query(`
    SELECT
      u.display_name AS seller_name,
      a.status,
      COUNT(*) AS count
    FROM crm.activities a
    INNER JOIN crm.customers c ON c.company_id = a.company_id AND c.customer_id = a.customer_id
    LEFT JOIN sec.users u ON u.company_id = a.company_id AND u.user_id = a.owner_user_id
    WHERE a.company_id = @company_id
      AND (@start_date IS NULL OR a.created_at >= @start_date)
      AND (@end_date IS NULL OR a.created_at <= @end_date)
      AND ${scopeSql("c")}
    GROUP BY u.display_name, a.status
    ORDER BY u.display_name, count DESC;
  `);

  // Actividades vencidas
  const overdueRes = await request.query(`
    SELECT TOP 50
      a.activity_id,
      a.subject,
      c.customer_name,
      a.activity_type_code,
      a.due_at,
      DATEDIFF(DAY, a.due_at, GETDATE()) AS days_overdue,
      u.display_name AS assigned_to
    FROM crm.activities a
    INNER JOIN crm.customers c ON c.company_id = a.company_id AND c.customer_id = a.customer_id
    LEFT JOIN sec.users u ON u.company_id = a.company_id AND u.user_id = a.owner_user_id
    WHERE a.company_id = @company_id
      AND a.status IN ('Pendiente', 'Programada')
      AND a.due_at IS NOT NULL
      AND a.due_at < GETDATE()
      AND ${scopeSql("c")}
    ORDER BY a.due_at ASC;
  `);

  // Tendencia diaria
  const dailyTrendRes = await request.query(`
    SELECT
      CAST(a.created_at AS DATE) AS activity_date,
      a.activity_type_code,
      COUNT(*) AS count
    FROM crm.activities a
    INNER JOIN crm.customers c ON c.company_id = a.company_id AND c.customer_id = a.customer_id
    WHERE a.company_id = @company_id
      AND (@start_date IS NULL OR a.created_at >= @start_date)
      AND (@end_date IS NULL OR a.created_at <= @end_date)
      AND ${scopeSql("c")}
    GROUP BY CAST(a.created_at AS DATE), a.activity_type_code
    ORDER BY activity_date DESC;
  `);

  // Resumen
  const totalActivities = (byStatusRes.recordset as ActivityByStatusRow[]).reduce((sum: number, row: ActivityByStatusRow) => sum + Number(row.count), 0);
  const completedActivities = (byStatusRes.recordset as ActivityByStatusRow[])
    .filter((row: ActivityByStatusRow) => row.status === "Completada")
    .reduce((sum: number, row: ActivityByStatusRow) => sum + Number(row.count), 0);

  return {
    byStatus: (byStatusRes.recordset as ActivityByStatusRow[]).map((row) => ({
      status: row.status,
      type: row.activity_type_code,
      count: Number(row.count),
      avgDaysToComplete: Number(row.avg_days_to_complete),
    })),
    bySeller: (bySellerRes.recordset as ActivityBySellerRow[]).map((row) => ({
      sellerName: row.seller_name,
      status: row.status,
      count: Number(row.count),
    })),
    overdue: (overdueRes.recordset as OverdueActivityRow[]).map((row) => ({
      activityId: row.activity_id,
      subject: row.subject,
      customerName: row.customer_name,
      type: row.activity_type_code,
      dueAt: row.due_at,
      daysOverdue: Number(row.days_overdue),
      assignedTo: row.assigned_to,
    })),
    dailyTrend: (dailyTrendRes.recordset as ActivityDailyTrendRow[]).map((row) => ({
      date: row.activity_date,
      type: row.activity_type_code,
      count: Number(row.count),
    })),
    summary: {
      total: totalActivities,
      completed: completedActivities,
      completionRate: totalActivities > 0 ? (completedActivities / totalActivities) * 100 : 0,
      overdueCount: overdueRes.recordset.length,
    },
  };
}

// ============================================
// REPORTE DE OPORTUNIDADES
// ============================================
export async function getOpportunitiesReport(
  companyId: number,
  userId: number,
  filters: ReportFilterInput
) {
  const pool = await getPool();
  const scope = await resolveUserScope(companyId, userId);

  let request = buildRequestParams(pool, companyId, scope);
  request = addDateFilters(request, filters);

  // Embudo de ventas (por etapa)
  const funnelRes = await request.query(`
    SELECT
      COALESCE(ps.stage_name, o.status) AS stage,
      ps.stage_order,
      COUNT(*) AS count,
      SUM(ISNULL(o.amount, 0)) AS total_amount,
      AVG(ISNULL(o.probability_pct, ps.default_probability_pct)) AS avg_probability
    FROM crm.opportunities o
    INNER JOIN crm.customers c ON c.company_id = o.company_id AND c.customer_id = o.customer_id
    LEFT JOIN crm.pipeline_stages ps ON ps.company_id = o.company_id AND ps.stage_id = o.stage_id
    WHERE o.company_id = @company_id
      AND (@status IS NULL OR o.status = @status)
      AND (@stage_ids_csv IS NULL OR o.stage_id IN (
        SELECT TRY_CAST(value AS INT) FROM STRING_SPLIT(@stage_ids_csv, ',')
      ))
      AND (@min_amount IS NULL OR o.amount >= @min_amount)
      AND (@max_amount IS NULL OR o.amount <= @max_amount)
      AND o.status NOT IN ('ganada', 'perdida')
      AND (@start_date IS NULL OR o.created_at >= @start_date)
      AND (@end_date IS NULL OR o.created_at <= @end_date)
      AND ${scopeSql("c")}
    GROUP BY COALESCE(ps.stage_name, o.status), ps.stage_order
    ORDER BY ps.stage_order;
  `);

  // Tasa de conversión por etapa
  const conversionRes = await request.query(`
    WITH stage_counts AS (
      SELECT
        COALESCE(ps.stage_name, o.status) AS stage,
        ps.stage_order,
        COUNT(*) AS count
      FROM crm.opportunities o
      INNER JOIN crm.customers c ON c.company_id = o.company_id AND c.customer_id = o.customer_id
      LEFT JOIN crm.pipeline_stages ps ON ps.company_id = o.company_id AND ps.stage_id = o.stage_id
      WHERE o.company_id = @company_id
        AND (@status IS NULL OR o.status = @status)
        AND (@stage_ids_csv IS NULL OR o.stage_id IN (
          SELECT TRY_CAST(value AS INT) FROM STRING_SPLIT(@stage_ids_csv, ',')
        ))
        AND (@min_amount IS NULL OR o.amount >= @min_amount)
        AND (@max_amount IS NULL OR o.amount <= @max_amount)
        AND (@start_date IS NULL OR o.created_at >= @start_date)
        AND (@end_date IS NULL OR o.created_at <= @end_date)
        AND ${scopeSql("c")}
      GROUP BY COALESCE(ps.stage_name, o.status), ps.stage_order
    )
    SELECT
      stage,
      stage_order,
      count,
      SUM(count) OVER (ORDER BY stage_order) AS cumulative_count,
      CAST(count AS FLOAT) / NULLIF(SUM(count) OVER (), 0) * 100 AS stage_percentage
    FROM stage_counts
    ORDER BY stage_order;
  `);

  // Por vendedor
  const bySellerRes = await request.query(`
    SELECT
      u.display_name AS seller_name,
      COUNT(*) AS total_count,
      SUM(CASE WHEN o.status = 'ganada' THEN 1 ELSE 0 END) AS won_count,
      SUM(CASE WHEN o.status = 'perdida' THEN 1 ELSE 0 END) AS lost_count,
      SUM(CASE WHEN o.status = 'abierta' THEN 1 ELSE 0 END) AS open_count,
      SUM(CASE WHEN o.status = 'ganada' THEN ISNULL(o.amount, 0) ELSE 0 END) AS won_amount,
      AVG(CASE WHEN o.status = 'ganada' THEN DATEDIFF(DAY, o.created_at, o.close_date) END) AS avg_days_to_close
    FROM crm.opportunities o
    INNER JOIN crm.customers c ON c.company_id = o.company_id AND c.customer_id = o.customer_id
    LEFT JOIN sec.users u ON u.company_id = o.company_id AND u.user_id = o.owner_user_id
    WHERE o.company_id = @company_id
      AND (@start_date IS NULL OR o.created_at >= @start_date)
      AND (@end_date IS NULL OR o.created_at <= @end_date)
      AND ${scopeSql("c")}
    GROUP BY u.display_name
    ORDER BY won_amount DESC;
  `);

  // Por producto
  const byProductRes = await request.query(`
    SELECT TOP 10
      COALESCE(oi.item_description, p.product_name) AS product_name,
      COUNT(DISTINCT o.opportunity_id) AS opportunity_count,
      SUM(ISNULL(oi.quantity, 0) * ISNULL(oi.unit_price, 0)) AS total_amount,
      SUM(CASE WHEN o.status = 'ganada' THEN ISNULL(oi.quantity, 0) * ISNULL(oi.unit_price, 0) ELSE 0 END) AS won_amount
    FROM crm.opportunities o
    INNER JOIN crm.customers c ON c.company_id = o.company_id AND c.customer_id = o.customer_id
    LEFT JOIN crm.opportunity_items oi ON oi.company_id = o.company_id AND oi.opportunity_id = o.opportunity_id
    LEFT JOIN crm.products p ON p.company_id = oi.company_id AND p.product_id = oi.product_id
    WHERE o.company_id = @company_id
      AND (@start_date IS NULL OR o.created_at >= @start_date)
      AND (@end_date IS NULL OR o.created_at <= @end_date)
      AND ${scopeSql("c")}
    GROUP BY COALESCE(oi.item_description, p.product_name)
    ORDER BY total_amount DESC;
  `);

  // Resumen
  const summaryRes = await request.query(`
    SELECT
      COUNT(*) AS total_opportunities,
      SUM(CASE WHEN o.status = 'ganada' THEN 1 ELSE 0 END) AS won_count,
      SUM(CASE WHEN o.status = 'perdida' THEN 1 ELSE 0 END) AS lost_count,
      SUM(CASE WHEN o.status = 'abierta' THEN 1 ELSE 0 END) AS open_count,
      SUM(CASE WHEN o.status = 'ganada' THEN ISNULL(o.amount, 0) ELSE 0 END) AS won_amount,
      SUM(CASE WHEN o.status = 'abierta' THEN ISNULL(o.amount, 0) ELSE 0 END) AS pipeline_amount,
      AVG(CASE WHEN o.status = 'ganada' THEN DATEDIFF(DAY, o.created_at, o.close_date) END) AS avg_days_to_close
    FROM crm.opportunities o
    INNER JOIN crm.customers c ON c.company_id = o.company_id AND c.customer_id = o.customer_id
    WHERE o.company_id = @company_id
      AND (@start_date IS NULL OR o.created_at >= @start_date)
      AND (@end_date IS NULL OR o.created_at <= @end_date)
      AND ${scopeSql("c")};
  `);

  const summary = (summaryRes.recordset[0] as OpportunitySummaryRow) || {
    total_opportunities: 0,
    won_count: 0,
    lost_count: 0,
    open_count: 0,
    won_amount: 0,
    pipeline_amount: 0,
    avg_days_to_close: 0,
  };

  return {
    funnel: (funnelRes.recordset as OpportunityFunnelRow[]).map((row) => ({
      stage: row.stage,
      stageOrder: Number(row.stage_order),
      count: Number(row.count),
      totalAmount: Number(row.total_amount),
      avgProbability: Number(row.avg_probability),
    })),
    conversion: (conversionRes.recordset as OpportunityConversionRow[]).map((row) => ({
      stage: row.stage,
      count: Number(row.count),
      cumulativeCount: Number(row.cumulative_count),
      stagePercentage: Number(row.stage_percentage),
    })),
    bySeller: (bySellerRes.recordset as OpportunityBySellerRow[]).map((row) => ({
      sellerName: row.seller_name,
      totalCount: Number(row.total_count),
      wonCount: Number(row.won_count),
      lostCount: Number(row.lost_count),
      openCount: Number(row.open_count),
      wonAmount: Number(row.won_amount),
      avgDaysToClose: Number(row.avg_days_to_close),
    })),
    byProduct: (byProductRes.recordset as OpportunityByProductRow[]).map((row) => ({
      productName: row.product_name,
      opportunityCount: Number(row.opportunity_count),
      totalAmount: Number(row.total_amount),
      wonAmount: Number(row.won_amount),
    })),
    summary: {
      totalOpportunities: Number(summary.total_opportunities),
      wonCount: Number(summary.won_count),
      lostCount: Number(summary.lost_count),
      openCount: Number(summary.open_count),
      wonAmount: Number(summary.won_amount),
      pipelineAmount: Number(summary.pipeline_amount),
      avgDaysToClose: Number(summary.avg_days_to_close),
      winRate:
        Number(summary.total_opportunities) > 0
          ? (Number(summary.won_count) / Number(summary.total_opportunities)) * 100
          : 0,
    },
  };
}

// ============================================
// REPORTE DE PRODUCTOS
// ============================================
export async function getProductsReport(
  companyId: number,
  userId: number,
  filters: ReportFilterInput
) {
  const pool = await getPool();
  const scope = await resolveUserScope(companyId, userId);

  let request = buildRequestParams(pool, companyId, scope);
  request = addDateFilters(request, filters);

  // Ventas por producto
  const salesByProductRes = await request.query(`
    SELECT
      p.product_id,
      p.product_name,
      p.sku,
      COALESCE(pc.category_name, 'Sin categoría') AS category_name,
      SUM(ISNULL(oi.quantity, 0)) AS total_quantity,
      SUM(ISNULL(oi.quantity, 0) * ISNULL(oi.unit_price, 0)) AS total_sales,
      COUNT(DISTINCT o.opportunity_id) AS opportunity_count,
      AVG(ISNULL(oi.unit_price, 0)) AS avg_price
    FROM crm.opportunity_items oi
    INNER JOIN crm.opportunities o ON o.company_id = oi.company_id AND o.opportunity_id = oi.opportunity_id
    INNER JOIN crm.customers c ON c.company_id = o.company_id AND c.customer_id = o.customer_id
    LEFT JOIN crm.products p ON p.company_id = oi.company_id AND p.product_id = oi.product_id
    LEFT JOIN crm.product_categories pc ON pc.company_id = p.company_id AND pc.category_id = p.category_id
    WHERE o.company_id = @company_id
      AND o.status = 'ganada'
      AND (@start_date IS NULL OR o.close_date >= @start_date)
      AND (@end_date IS NULL OR o.close_date <= @end_date)
      AND ${scopeSql("c")}
    GROUP BY p.product_id, p.product_name, p.sku, pc.category_name
    ORDER BY total_sales DESC;
  `);

  // Por categoría real
  const salesByCategoryRes = await request.query(`
    SELECT
      COALESCE(pc.category_name, 'Sin categoría') AS category_name,
      SUM(ISNULL(oi.quantity, 0) * ISNULL(oi.unit_price, 0)) AS total_sales,
      COUNT(DISTINCT p.product_id) AS product_count,
      COUNT(DISTINCT o.opportunity_id) AS opportunity_count
    FROM crm.opportunity_items oi
    INNER JOIN crm.opportunities o ON o.company_id = oi.company_id AND o.opportunity_id = oi.opportunity_id
    INNER JOIN crm.customers c ON c.company_id = o.company_id AND c.customer_id = o.customer_id
    LEFT JOIN crm.products p ON p.company_id = oi.company_id AND p.product_id = oi.product_id
    LEFT JOIN crm.product_categories pc ON pc.company_id = p.company_id AND pc.category_id = p.category_id
    WHERE o.company_id = @company_id
      AND o.status = 'ganada'
      AND (@start_date IS NULL OR o.close_date >= @start_date)
      AND (@end_date IS NULL OR o.close_date <= @end_date)
      AND ${scopeSql("c")}
    GROUP BY COALESCE(pc.category_name, 'Sin categoría')
    ORDER BY total_sales DESC;
  `);

  // Top productos por cantidad
  const topByQuantityRes = await request.query(`
    SELECT TOP 10
      p.product_name,
      SUM(ISNULL(oi.quantity, 0)) AS total_quantity
    FROM crm.opportunity_items oi
    INNER JOIN crm.opportunities o ON o.company_id = oi.company_id AND o.opportunity_id = oi.opportunity_id
    INNER JOIN crm.customers c ON c.company_id = o.company_id AND c.customer_id = o.customer_id
    LEFT JOIN crm.products p ON p.company_id = oi.company_id AND p.product_id = oi.product_id
    WHERE o.company_id = @company_id
      AND o.status = 'ganada'
      AND (@start_date IS NULL OR o.close_date >= @start_date)
      AND (@end_date IS NULL OR o.close_date <= @end_date)
      AND ${scopeSql("c")}
    GROUP BY p.product_name
    ORDER BY total_quantity DESC;
  `);

  // Resumen
  const totalSales = (salesByProductRes.recordset as ProductSalesRow[]).reduce(
    (sum: number, row: ProductSalesRow) => sum + Number(row.total_sales),
    0
  );
  const totalQuantity = (salesByProductRes.recordset as ProductSalesRow[]).reduce(
    (sum: number, row: ProductSalesRow) => sum + Number(row.total_quantity),
    0
  );

  return {
    salesByProduct: (salesByProductRes.recordset as any[]).map((row) => ({
      productId: row.product_id,
      productName: row.product_name,
      sku: row.sku,
      category: row.category_name || 'Sin categoría',
      totalQuantity: Number(row.total_quantity),
      totalSales: Number(row.total_sales),
      opportunityCount: Number(row.opportunity_count),
      avgPrice: Number(row.avg_price),
      percentage: totalSales > 0 ? (Number(row.total_sales) / totalSales) * 100 : 0,
    })),
    salesByCategory: (salesByCategoryRes.recordset as any[]).map((row) => ({
      category: row.category_name,
      totalSales: Number(row.total_sales),
      productCount: Number(row.product_count),
      opportunityCount: Number(row.opportunity_count),
      percentage: totalSales > 0 ? (Number(row.total_sales) / totalSales) * 100 : 0,
    })),
    topByQuantity: (topByQuantityRes.recordset as TopProductRow[]).map((row) => ({
      productName: row.product_name,
      totalQuantity: Number(row.total_quantity),
    })),
    summary: {
      totalSales,
      totalQuantity,
      totalProducts: salesByProductRes.recordset.length,
      avgSalePerProduct:
        salesByProductRes.recordset.length > 0 ? totalSales / salesByProductRes.recordset.length : 0,
    },
  };
}

// ============================================
// VISTAS GUARDADAS
// ============================================
export async function getSavedViews(companyId: number, userId: number) {
  const pool = await getPool();

  const result = await pool
    .request()
    .input("company_id", sql.Int, companyId)
    .input("user_id", sql.Int, userId)
    .query(`
      SELECT
        view_id,
        report_type,
        view_name,
        filters,
        is_default,
        created_at,
        updated_at
      FROM crm.report_saved_views
      WHERE company_id = @company_id
        AND user_id = @user_id
      ORDER BY is_default DESC, view_name;
    `);

  return (result.recordset as SavedViewRow[]).map((row) => ({
    viewId: row.view_id,
    reportType: row.report_type,
    viewName: row.view_name,
    filters: JSON.parse(row.filters),
    isDefault: row.is_default,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function createSavedView(
  companyId: number,
  userId: number,
  data: { viewName: string; reportType: string; filters: any; isDefault?: boolean }
) {
  const pool = await getPool();

  // Si es default, quitar default de otras vistas del mismo tipo
  if (data.isDefault) {
    await pool
      .request()
      .input("company_id", sql.Int, companyId)
      .input("user_id", sql.Int, userId)
      .input("report_type", sql.VarChar(50), data.reportType)
      .query(`
        UPDATE crm.report_saved_views
        SET is_default = 0
        WHERE company_id = @company_id
          AND user_id = @user_id
          AND report_type = @report_type;
      `);
  }

  const result = await pool
    .request()
    .input("company_id", sql.Int, companyId)
    .input("user_id", sql.Int, userId)
    .input("report_type", sql.VarChar(50), data.reportType)
    .input("view_name", sql.VarChar(100), data.viewName)
    .input("filters", sql.NVarChar(sql.MAX), JSON.stringify(data.filters))
    .input("is_default", sql.Bit, data.isDefault ? 1 : 0)
    .query(`
      INSERT INTO crm.report_saved_views (company_id, user_id, report_type, view_name, filters, is_default)
      VALUES (@company_id, @user_id, @report_type, @view_name, @filters, @is_default);
      
      SELECT SCOPE_IDENTITY() AS view_id;
    `);

  return result.recordset[0].view_id;
}

export async function updateSavedView(
  companyId: number,
  userId: number,
  viewId: number,
  data: { viewName?: string; filters?: any; isDefault?: boolean }
) {
  const pool = await getPool();

  // Verificar que la vista existe y pertenece al usuario
  const check = await pool
    .request()
    .input("view_id", sql.Int, viewId)
    .input("company_id", sql.Int, companyId)
    .input("user_id", sql.Int, userId)
    .query(`
      SELECT view_id, report_type
      FROM crm.report_saved_views
      WHERE view_id = @view_id
        AND company_id = @company_id
        AND user_id = @user_id;
    `);

  if (!check.recordset[0]) {
    throw new Error("Vista no encontrada");
  }

  // Si es default, quitar default de otras vistas del mismo tipo
  if (data.isDefault) {
    await pool
      .request()
      .input("company_id", sql.Int, companyId)
      .input("user_id", sql.Int, userId)
      .input("report_type", sql.VarChar(50), check.recordset[0].report_type)
      .query(`
        UPDATE crm.report_saved_views
        SET is_default = 0
        WHERE company_id = @company_id
          AND user_id = @user_id
          AND report_type = @report_type
          AND view_id != @view_id;
      `);
  }

  const updates: string[] = [];
  const request = pool
    .request()
    .input("view_id", sql.Int, viewId)
    .input("company_id", sql.Int, companyId)
    .input("user_id", sql.Int, userId);

  if (data.viewName !== undefined) {
    updates.push("view_name = @view_name");
    request.input("view_name", sql.VarChar(100), data.viewName);
  }

  if (data.filters !== undefined) {
    updates.push("filters = @filters");
    request.input("filters", sql.NVarChar(sql.MAX), JSON.stringify(data.filters));
  }

  if (data.isDefault !== undefined) {
    updates.push("is_default = @is_default");
    request.input("is_default", sql.Bit, data.isDefault ? 1 : 0);
  }

  if (updates.length > 0) {
    updates.push("updated_at = SYSUTCDATETIME()");
    await request.query(`
      UPDATE crm.report_saved_views
      SET ${updates.join(", ")}
      WHERE view_id = @view_id
        AND company_id = @company_id
        AND user_id = @user_id;
    `);
  }
}

export async function deleteSavedView(companyId: number, userId: number, viewId: number) {
  const pool = await getPool();

  await pool
    .request()
    .input("view_id", sql.Int, viewId)
    .input("company_id", sql.Int, companyId)
    .input("user_id", sql.Int, userId)
    .query(`
      DELETE FROM crm.report_saved_views
      WHERE view_id = @view_id
        AND company_id = @company_id
        AND user_id = @user_id;
    `);
}

// ============================================
// REPORTES PROGRAMADOS
// ============================================
export async function getScheduledReports(companyId: number, userId: number) {
  const pool = await getPool();

  const result = await pool
    .request()
    .input("company_id", sql.Int, companyId)
    .input("user_id", sql.Int, userId)
    .query(`
      SELECT
        schedule_id,
        report_type,
        frequency,
        day_of_week,
        day_of_month,
        recipients,
        filters,
        next_run_at,
        last_run_at,
        is_active,
        created_at,
        updated_at
      FROM crm.report_scheduled
      WHERE company_id = @company_id
        AND user_id = @user_id
      ORDER BY is_active DESC, next_run_at;
    `);

  return (result.recordset as ScheduledReportRow[]).map((row) => ({
    scheduleId: row.schedule_id,
    reportType: row.report_type,
    frequency: row.frequency,
    dayOfWeek: row.day_of_week,
    dayOfMonth: row.day_of_month,
    recipients: JSON.parse(row.recipients),
    filters: JSON.parse(row.filters),
    nextRunAt: row.next_run_at,
    lastRunAt: row.last_run_at,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function createScheduledReport(
  companyId: number,
  userId: number,
  data: {
    reportType: string;
    frequency: string;
    dayOfWeek?: number;
    dayOfMonth?: number;
    recipients: string[];
    filters: any;
    isActive?: boolean;
  }
) {
  const pool = await getPool();

  // Calcular próxima ejecución
  const nextRun = calculateNextRun(data.frequency, data.dayOfWeek, data.dayOfMonth);

  const result = await pool
    .request()
    .input("company_id", sql.Int, companyId)
    .input("user_id", sql.Int, userId)
    .input("report_type", sql.VarChar(50), data.reportType)
    .input("frequency", sql.VarChar(20), data.frequency)
    .input("day_of_week", sql.TinyInt, data.dayOfWeek ?? null)
    .input("day_of_month", sql.TinyInt, data.dayOfMonth ?? null)
    .input("recipients", sql.NVarChar(sql.MAX), JSON.stringify(data.recipients))
    .input("filters", sql.NVarChar(sql.MAX), JSON.stringify(data.filters))
    .input("next_run_at", sql.DateTime2, nextRun)
    .input("is_active", sql.Bit, data.isActive !== false ? 1 : 0)
    .query(`
      INSERT INTO crm.report_scheduled 
        (company_id, user_id, report_type, frequency, day_of_week, day_of_month, 
         recipients, filters, next_run_at, is_active)
      VALUES 
        (@company_id, @user_id, @report_type, @frequency, @day_of_week, @day_of_month,
         @recipients, @filters, @next_run_at, @is_active);
      
      SELECT SCOPE_IDENTITY() AS schedule_id;
    `);

  return result.recordset[0].schedule_id;
}

export async function updateScheduledReport(
  companyId: number,
  userId: number,
  scheduleId: number,
  data: {
    frequency?: string;
    dayOfWeek?: number;
    dayOfMonth?: number;
    recipients?: string[];
    filters?: any;
    isActive?: boolean;
  }
) {
  const pool = await getPool();

  // Verificar que existe
  const check = await pool
    .request()
    .input("schedule_id", sql.Int, scheduleId)
    .input("company_id", sql.Int, companyId)
    .input("user_id", sql.Int, userId)
    .query(`
      SELECT schedule_id
      FROM crm.report_scheduled
      WHERE schedule_id = @schedule_id
        AND company_id = @company_id
        AND user_id = @user_id;
    `);

  if (!check.recordset[0]) {
    throw new Error("Reporte programado no encontrado");
  }

  const updates: string[] = [];
  const request = pool
    .request()
    .input("schedule_id", sql.Int, scheduleId)
    .input("company_id", sql.Int, companyId)
    .input("user_id", sql.Int, userId);

  if (data.frequency !== undefined) {
    updates.push("frequency = @frequency");
    request.input("frequency", sql.VarChar(20), data.frequency);
  }

  if (data.dayOfWeek !== undefined) {
    updates.push("day_of_week = @day_of_week");
    request.input("day_of_week", sql.TinyInt, data.dayOfWeek);
  }

  if (data.dayOfMonth !== undefined) {
    updates.push("day_of_month = @day_of_month");
    request.input("day_of_month", sql.TinyInt, data.dayOfMonth);
  }

  if (data.recipients !== undefined) {
    updates.push("recipients = @recipients");
    request.input("recipients", sql.NVarChar(sql.MAX), JSON.stringify(data.recipients));
  }

  if (data.filters !== undefined) {
    updates.push("filters = @filters");
    request.input("filters", sql.NVarChar(sql.MAX), JSON.stringify(data.filters));
  }

  if (data.isActive !== undefined) {
    updates.push("is_active = @is_active");
    request.input("is_active", sql.Bit, data.isActive ? 1 : 0);
  }

  if (updates.length > 0) {
    updates.push("updated_at = SYSUTCDATETIME()");
    await request.query(`
      UPDATE crm.report_scheduled
      SET ${updates.join(", ")}
      WHERE schedule_id = @schedule_id
        AND company_id = @company_id
        AND user_id = @user_id;
    `);
  }
}

export async function deleteScheduledReport(companyId: number, userId: number, scheduleId: number) {
  const pool = await getPool();

  await pool
    .request()
    .input("schedule_id", sql.Int, scheduleId)
    .input("company_id", sql.Int, companyId)
    .input("user_id", sql.Int, userId)
    .query(`
      DELETE FROM crm.report_scheduled
      WHERE schedule_id = @schedule_id
        AND company_id = @company_id
        AND user_id = @user_id;
    `);
}

function calculateNextRun(frequency: string, dayOfWeek?: number, dayOfMonth?: number): Date {
  const now = new Date();
  let nextRun = new Date(now);

  switch (frequency) {
    case "daily":
      nextRun.setDate(nextRun.getDate() + 1);
      nextRun.setHours(8, 0, 0, 0);
      break;
    case "weekly":
      const targetDay = dayOfWeek ?? 1; // Lunes por defecto
      const currentDay = nextRun.getDay();
      const daysUntilTarget = (targetDay - currentDay + 7) % 7 || 7;
      nextRun.setDate(nextRun.getDate() + daysUntilTarget);
      nextRun.setHours(8, 0, 0, 0);
      break;
    case "monthly":
      const targetDate = dayOfMonth ?? 1;
      nextRun.setDate(targetDate);
      if (nextRun <= now) {
        nextRun.setMonth(nextRun.getMonth() + 1);
      }
      nextRun.setHours(8, 0, 0, 0);
      break;
    default:
      nextRun.setDate(nextRun.getDate() + 1);
      nextRun.setHours(8, 0, 0, 0);
  }

  return nextRun;
}