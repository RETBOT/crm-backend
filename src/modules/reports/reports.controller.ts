import { Request, Response } from "express";
import { getPool, sql } from "../../db/sqlserver";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import xss from "xss";
import { abcError, abcSuccess } from "../../shared/legacy-response";
import { PERMISSIONS } from "../auth/permissions";
import { logger } from "../../config/logger";
import {
  reportFilterSchema,
  exportReportSchema,
  savedViewSchema,
  savedViewUpdateSchema,
  scheduledReportSchema,
  scheduledReportUpdateSchema,
} from "./reports.schemas";
import {
  getDashboardExecutive,
  getSalesReport,
  getCustomersReport,
  getActivitiesReport,
  getOpportunitiesReport,
  getProductsReport,
  getSavedViews,
  createSavedView,
  updateSavedView,
  deleteSavedView,
  getScheduledReports,
  createScheduledReport,
  updateScheduledReport,
  deleteScheduledReport,
} from "./reports.service";

// ============================================
// TRADUCCIONES Y MAPEO DE COLUMNAS
// ============================================

const REPORT_TITLES: Record<string, string> = {
  dashboard: "Dashboard Ejecutivo",
  sales: "Reporte de Ventas",
  customers: "Reporte de Clientes",
  activities: "Reporte de Actividades",
  opportunities: "Reporte de Oportunidades",
  products: "Reporte de Productos",
};

const COLUMN_MAP: Record<string, string> = {
  // Dashboard KPI keys
  sales: "Ventas",
  won: "Oportunidades Ganadas",
  newCustomers: "Clientes Nuevos",
  activities: "Actividades Completadas",
  // Dashboard chart names
  salesTrend: "Tendencia de Ventas",
  opportunitiesStatus: "Oportunidades por Etapa",
  activitiesStatus: "Actividades por Estado",
  topSellers: "Top Vendedores",
  // Dashboard chart columns
  month: "Mes",
  amount: "Monto",
  // Ventas
  totalSales: "Total Ventas",
  wonCount: "Ventas Ganadas",
  sellerName: "Vendedor",
  branchName: "Sucursal",
  period: "Periodo",
  avgProbability: "Probabilidad Promedio",
  firstSaleDate: "Primera Venta",
  lastSaleDate: "Última Venta",
  // Clientes
  customerName: "Cliente",
  purchaseCount: "Compras",
  totalPurchases: "Total Compras",
  daysInactive: "Días Inactivo",
  lastPurchaseDate: "Última Compra",
  customerId: "ID Cliente",
  // Oportunidades
  stage: "Etapa",
  count: "Cantidad",
  totalAmount: "Monto Total",
  wonAmount: "Monto Ganado",
  pipelineAmount: "Pipeline",
  winRate: "Tasa de Conversión",
  avgDaysToClose: "Días Promedio Cierre",
  totalOpportunities: "Total Oportunidades",
  stageOrder: "Orden Etapa",
  cumulativeCount: "Cantidad Acumulada",
  stagePercentage: "% Etapa",
  totalCount: "Total Oportunidades",
  // Actividades
  subject: "Asunto",
  type: "Tipo",
  assignedTo: "Asignado a",
  daysOverdue: "Días Vencida",
  status: "Estado",
  completionRate: "Tasa de Completado",
  overdueCount: "Actividades Vencidas",
  completed: "Completadas",
  avgDaysToComplete: "Días Promedio",
  activityId: "ID Actividad",
  dueAt: "Fecha Vencimiento",
  date: "Fecha",
  // Productos
  category: "Categoría",
  category_name: "Categoría",
  sku: "SKU",
  totalQuantity: "Cantidad Vendida",
  productCount: "Productos",
  opportunityCount: "Oportunidades",
  percentage: "% del Total",
  productName: "Producto",
  productId: "ID Producto",
  avgPrice: "Precio Promedio",
  // Totals y KPIs genéricos
  total: "Total",
  avgSaleAmount: "Promedio por Venta",
  totalWon: "Cantidad de Ventas",
  totalProducts: "Productos Activos",
  avgSalePerProduct: "Promedio por Producto",
  totalCustomers: "Total Clientes",
  activeLast3Months: "Clientes Activos",
  totalProspects: "Prospects",
  current: "Actual",
  previous: "Anterior",
  change: "Cambio",
  value: "Valor",
  name: "Nombre",
  metrica: "Métrica",
  valor: "Valor",
  campo: "Campo",
  pending: "Pendientes",
  scheduled: "Programadas",
  openCount: "Abiertas",
  lostCount: "Perdidas",
};

const CURRENCY_COLUMNS = [
  "totalSales", "totalPurchases", "totalAmount", "wonAmount",
  "pipelineAmount", "avgSaleAmount", "avgSalePerProduct", "actual", "previous",
  "amount", "avgPrice",
];

const PERCENTAGE_COLUMNS = [
  "winRate", "completionRate", "percentage", "change", "avgProbability", "stagePercentage",
];

const DATE_COLUMNS = [
  "lastPurchaseDate", "generated_at", "created_at", "updated_at",
  "firstSaleDate", "lastSaleDate", "dueAt", "date",
];

function translateColumnName(key: string): string {
  return COLUMN_MAP[key] || key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function translateReportTitle(reportType: string): string {
  return REPORT_TITLES[reportType] || reportType;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 0 }).format(value);
}

function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

function isCurrencyColumn(key: string): boolean {
  const lower = key.toLowerCase();
  return CURRENCY_COLUMNS.includes(key) ||
    lower.includes("total ventas") || lower.includes("monto total") || lower.includes("monto ganado") ||
    lower.includes("pipeline") || lower.includes("promedio por venta") || lower.includes("promedio por producto") ||
    lower.includes("actual") || lower.includes("anterior") || lower.includes("total compras") ||
    lower.includes("monto") || lower.includes("precio promedio");
}

function isPercentageColumn(key: string): boolean {
  const lower = key.toLowerCase();
  return PERCENTAGE_COLUMNS.includes(key) ||
    lower.includes("tasa de conversi") || lower.includes("tasa de completado") ||
    lower.includes("% del total") || lower.includes("% etapa") || lower.includes("cambio") ||
    lower.includes("probabilidad");
}

function isDateColumn(key: string): boolean {
  const lower = key.toLowerCase();
  return DATE_COLUMNS.includes(key) ||
    lower.includes("última compra") || lower.includes("primera venta") || lower.includes("última venta") ||
    lower.includes("fecha vencimiento") || lower.includes("fecha");
}

function formatFiltersForDisplay(filters?: Record<string, any>): { label: string; value: string }[] {
  if (!filters) return [];
  const result: { label: string; value: string }[] = [];
  const dateLabels: Record<string, string> = {
    START_DATE: "Fecha Inicio",
    END_DATE: "Fecha Fin",
    COMPARE_START_DATE: "Fecha Inicio Comparativa",
    COMPARE_END_DATE: "Fecha Fin Comparativa",
  };
  for (const [key, value] of Object.entries(filters)) {
    if (value === null || value === undefined || value === "") continue;
    if (key === "SEARCH" && value) {
      result.push({ label: "Búsqueda", value: String(value) });
    } else if (key === "STATUS" && value) {
      result.push({ label: "Estado", value: String(value) });
    } else if (key === "BRANCH_IDS" && Array.isArray(value) && value.length > 0) {
      result.push({ label: "Sucursales", value: `${value.length} seleccionada(s)` });
    } else if (key === "USER_IDS" && Array.isArray(value) && value.length > 0) {
      result.push({ label: "Vendedores", value: `${value.length} seleccionado(s)` });
    } else if (key === "PRODUCT_IDS" && Array.isArray(value) && value.length > 0) {
      result.push({ label: "Productos", value: `${value.length} seleccionado(s)` });
    } else if (key === "STAGE_IDS" && Array.isArray(value) && value.length > 0) {
      result.push({ label: "Etapas", value: `${value.length} seleccionada(s)` });
    } else if (key === "MIN_AMOUNT" && value) {
      result.push({ label: "Monto Mínimo", value: formatCurrency(Number(value)) });
    } else if (key === "MAX_AMOUNT" && value) {
      result.push({ label: "Monto Máximo", value: formatCurrency(Number(value)) });
    } else if (dateLabels[key] && value) {
      const dateStr = new Date(String(value)).toLocaleDateString("es-MX");
      result.push({ label: dateLabels[key], value: dateStr });
    }
  }
  return result;
}

// ============================================
// HELPER: Verificar permisos
// ============================================
function hasPermission(req: Request, permission: string): boolean {
  return !!req.auth?.permissions?.includes(permission);
}

// ============================================
// REPORTES PRINCIPALES
// ============================================

// Dashboard Ejecutivo
export async function getDashboardHandler(req: Request, res: Response): Promise<void> {
  if (!hasPermission(req, PERMISSIONS.REPORTS_VIEW)) {
    res.status(403).json(abcError("No tiene permisos para ver reportes"));
    return;
  }

  try {
    const filters = reportFilterSchema.parse(req.body ?? {});
    const data = await getDashboardExecutive(req.auth!.companyId, req.auth!.userId, filters);
    res.json({ resultado: 1, data });
  } catch (error: any) {
    logger.error({ error, body: req.body }, "Error al obtener dashboard");
    if (error.name === "ZodError") {
      res.status(400).json({ resultado: -1, msg: "Datos inválidos", errors: error.errors });
    } else {
      res.status(500).json(abcError("Error al obtener dashboard"));
    }
  }
}

// Reporte de Ventas
export async function getSalesReportHandler(req: Request, res: Response): Promise<void> {
  if (!hasPermission(req, PERMISSIONS.REPORTS_VIEW)) {
    res.status(403).json(abcError("No tiene permisos para ver reportes"));
    return;
  }

  try {
    const filters = reportFilterSchema.parse(req.body ?? {});
    const data = await getSalesReport(req.auth!.companyId, req.auth!.userId, filters);
    res.json({ resultado: 1, data });
  } catch (error: any) {
    logger.error({ error, body: req.body }, "Error al obtener reporte de ventas");
    if (error.name === "ZodError") {
      res.status(400).json({ resultado: -1, msg: "Datos inválidos", errors: error.errors });
    } else {
      res.status(500).json(abcError("Error al obtener reporte de ventas"));
    }
  }
}

// Reporte de Clientes
export async function getCustomersReportHandler(req: Request, res: Response): Promise<void> {
  if (!hasPermission(req, PERMISSIONS.REPORTS_VIEW)) {
    res.status(403).json(abcError("No tiene permisos para ver reportes"));
    return;
  }

  try {
    const filters = reportFilterSchema.parse(req.body ?? {});
    const data = await getCustomersReport(req.auth!.companyId, req.auth!.userId, filters);
    res.json({ resultado: 1, data });
  } catch (error: any) {
    logger.error({ error, body: req.body }, "Error al obtener reporte de clientes");
    if (error.name === "ZodError") {
      res.status(400).json({ resultado: -1, msg: "Datos inválidos", errors: error.errors });
    } else {
      res.status(500).json(abcError("Error al obtener reporte de clientes"));
    }
  }
}

// Reporte de Actividades
export async function getActivitiesReportHandler(req: Request, res: Response): Promise<void> {
  if (!hasPermission(req, PERMISSIONS.REPORTS_VIEW)) {
    res.status(403).json(abcError("No tiene permisos para ver reportes"));
    return;
  }

  try {
    const filters = reportFilterSchema.parse(req.body ?? {});
    const data = await getActivitiesReport(req.auth!.companyId, req.auth!.userId, filters);
    res.json({ resultado: 1, data });
  } catch (error: any) {
    logger.error({ error, body: req.body }, "Error al obtener reporte de actividades");
    if (error.name === "ZodError") {
      res.status(400).json({ resultado: -1, msg: "Datos inválidos", errors: error.errors });
    } else {
      res.status(500).json(abcError("Error al obtener reporte de actividades"));
    }
  }
}

// Reporte de Oportunidades
export async function getOpportunitiesReportHandler(req: Request, res: Response): Promise<void> {
  if (!hasPermission(req, PERMISSIONS.REPORTS_VIEW)) {
    res.status(403).json(abcError("No tiene permisos para ver reportes"));
    return;
  }

  try {
    const filters = reportFilterSchema.parse(req.body ?? {});
    const data = await getOpportunitiesReport(req.auth!.companyId, req.auth!.userId, filters);
    res.json({ resultado: 1, data });
  } catch (error: any) {
    logger.error({ error, body: req.body }, "Error al obtener reporte de oportunidades");
    if (error.name === "ZodError") {
      res.status(400).json({ resultado: -1, msg: "Datos inválidos", errors: error.errors });
    } else {
      res.status(500).json(abcError("Error al obtener reporte de oportunidades"));
    }
  }
}

// Reporte de Productos
export async function getProductsReportHandler(req: Request, res: Response): Promise<void> {
  if (!hasPermission(req, PERMISSIONS.REPORTS_VIEW)) {
    res.status(403).json(abcError("No tiene permisos para ver reportes"));
    return;
  }

  try {
    const filters = reportFilterSchema.parse(req.body ?? {});
    const data = await getProductsReport(req.auth!.companyId, req.auth!.userId, filters);
    res.json({ resultado: 1, data });
  } catch (error: any) {
    logger.error({ error, body: req.body }, "Error al obtener reporte de productos");
    if (error.name === "ZodError") {
      res.status(400).json({ resultado: -1, msg: "Datos inválidos", errors: error.errors });
    } else {
      res.status(500).json(abcError("Error al obtener reporte de productos"));
    }
  }
}

// ============================================
// EXPORTACIÓN
// ============================================

// Helper: Sanitizar strings para prevenir XSS en reportes
function sanitizeValue(value: unknown): unknown {
  if (typeof value === "string") {
    return xss(value, { whiteList: {}, stripIgnoreTag: true, stripIgnoreTagBody: ["script"] });
  }
  return value;
}

// Helper: Traducir keys de un array de objetos
function translateRowArray(rows: any[]): any[] {
  return rows.map((row: any) => {
    const newRow: any = {};
    for (const [k, v] of Object.entries(row)) {
      newRow[translateColumnName(k)] = sanitizeValue(v);
    }
    return newRow;
  });
}

// Helper: Extraer estructura del reporte
function flattenReportData(reportType: string, data: any) {
  const result: { summary: any[]; charts: { name: string; data: any[] }[]; detail: any[] } = {
    summary: [],
    charts: [],
    detail: [],
  };

  if (!data) return result;

  // Dashboard: { kpi: {...}, charts: {...} }
  if (data.kpi) {
    for (const [key, value] of Object.entries(data.kpi as Record<string, any>)) {
      if (value && typeof value === "object") {
        result.summary.push({
          métrica: translateColumnName(key),
          actual: value.current ?? "",
          anterior: value.previous ?? "",
          cambio: value.change ? `${value.change > 0 ? "+" : ""}${value.change.toFixed(1)}%` : "",
        });
      }
    }
    if (data.charts) {
      for (const [name, chartData] of Object.entries(data.charts as Record<string, any>)) {
        if (Array.isArray(chartData) && chartData.length > 0) {
          result.charts.push({ name: translateColumnName(name), data: translateRowArray(chartData) });
        }
      }
    }
    return result;
  }

  // Ventas: { data: [...], totals: {...} }
  if (Array.isArray(data.data)) {
    result.detail = translateRowArray(data.data);
    if (data.totals) {
      result.summary = Object.entries(data.totals).map(([key, value]) => ({
        métrica: translateColumnName(key),
        valor: typeof value === "number" ? value.toLocaleString("es-MX") : String(value),
      }));
    }
    return result;
  }

  // Clientes: { newCustomers, recurrentCustomers, inactiveCustomers, summary }
  if (reportType === "customers") {
    if (data.summary) {
      result.summary = Object.entries(data.summary).map(([key, value]) => ({
        métrica: translateColumnName(key),
        valor: typeof value === "number" ? value.toLocaleString("es-MX") : String(value),
      }));
    }
    if (Array.isArray(data.newCustomers)) {
      result.charts.push({ name: "Clientes Nuevos por Periodo", data: translateRowArray(data.newCustomers) });
    }
    if (Array.isArray(data.recurrentCustomers)) {
      result.charts.push({ name: "Clientes Recurrentes", data: translateRowArray(data.recurrentCustomers) });
    }
    if (Array.isArray(data.inactiveCustomers)) {
      result.charts.push({ name: "Clientes Inactivos", data: translateRowArray(data.inactiveCustomers) });
    }
    return result;
  }

  // Actividades: { byStatus, bySeller, overdue, dailyTrend, summary }
  if (reportType === "activities") {
    if (data.summary) {
      result.summary = Object.entries(data.summary).map(([key, value]) => ({
        métrica: translateColumnName(key),
        valor: typeof value === "number" ? value.toLocaleString("es-MX") : String(value),
      }));
    }
    if (Array.isArray(data.byStatus)) {
      result.charts.push({ name: "Por Estado y Tipo", data: translateRowArray(data.byStatus) });
    }
    if (Array.isArray(data.bySeller)) {
      result.charts.push({ name: "Por Vendedor", data: translateRowArray(data.bySeller) });
    }
    if (Array.isArray(data.overdue)) {
      result.charts.push({ name: "Actividades Vencidas", data: translateRowArray(data.overdue) });
    }
    if (Array.isArray(data.dailyTrend)) {
      result.charts.push({ name: "Tendencia Diaria", data: translateRowArray(data.dailyTrend) });
    }
    return result;
  }

  // Oportunidades: { funnel, conversion, bySeller, byProduct, summary }
  if (reportType === "opportunities") {
    if (data.summary) {
      result.summary = Object.entries(data.summary).map(([key, value]) => ({
        métrica: translateColumnName(key),
        valor: typeof value === "number" ? value.toLocaleString("es-MX") : String(value),
      }));
    }
    if (Array.isArray(data.funnel)) {
      result.charts.push({ name: "Embudo de Ventas", data: translateRowArray(data.funnel) });
    }
    if (Array.isArray(data.conversion)) {
      result.charts.push({ name: "Tasa de Conversión", data: translateRowArray(data.conversion) });
    }
    if (Array.isArray(data.bySeller)) {
      result.charts.push({ name: "Por Vendedor", data: translateRowArray(data.bySeller) });
    }
    if (Array.isArray(data.byProduct)) {
      result.charts.push({ name: "Por Producto", data: translateRowArray(data.byProduct) });
    }
    return result;
  }

  // Productos: { salesByProduct, salesByCategory, topByQuantity, summary }
  if (reportType === "products") {
    if (data.summary) {
      result.summary = Object.entries(data.summary).map(([key, value]) => ({
        métrica: translateColumnName(key),
        valor: typeof value === "number" ? value.toLocaleString("es-MX") : String(value),
      }));
    }
    if (Array.isArray(data.salesByProduct)) {
      result.charts.push({ name: "Ventas por Producto", data: translateRowArray(data.salesByProduct) });
    }
    if (Array.isArray(data.salesByCategory)) {
      result.charts.push({ name: "Ventas por Categoría", data: translateRowArray(data.salesByCategory) });
    }
    if (Array.isArray(data.topByQuantity)) {
      result.charts.push({ name: "Top por Cantidad", data: translateRowArray(data.topByQuantity) });
    }
    return result;
  }

  // Fallback genérico
  if (Array.isArray(data)) {
    result.detail = translateRowArray(data);
  } else if (typeof data === "object") {
    for (const [key, value] of Object.entries(data)) {
      if (Array.isArray(value) && value.length > 0 && typeof value[0] === "object") {
        result.charts.push({ name: translateColumnName(key), data: translateRowArray(value) });
      } else if (typeof value === "object" && value !== null) {
        result.summary.push({
          métrica: translateColumnName(key),
          valor: JSON.stringify(value).substring(0, 100),
        });
      } else {
        result.summary.push({
          métrica: translateColumnName(key),
          valor: String(value),
        });
      }
    }
  }

  return result;
}

// Helper: Calcular anchos de columna para PDF
function calculatePDFColWidths(headers: string[], rowCount: number, pageWidth: number, margins: number) {
  const availableWidth = pageWidth - margins;
  const baseWidth = availableWidth / headers.length;
  return headers.map(() => Math.max(50, Math.min(baseWidth, 180)));
}

// Helper: Agregar tabla al PDF
function addPDFTable(doc: any, headers: string[], rows: any[], colWidths: number[], startY?: number) {
  const rowHeight = 18;
  const headerHeight = 20;
  const totalWidth = colWidths.reduce((a, b) => a + b, 0);
  const startX = (doc.page.width - doc.page.margins.left - doc.page.margins.right - totalWidth) / 2 + doc.page.margins.left;

  const needsNewPage = (requiredHeight: number) => {
    if (doc.y + requiredHeight > doc.page.height - doc.page.margins.bottom - 30) {
      doc.addPage();
      doc.fillColor("#4472C4").rect(startX, doc.page.margins.top, totalWidth, headerHeight).fill();
      doc.fillColor("#FFFFFF").fontSize(8).font("Helvetica-Bold");
      let xPos2 = startX;
      headers.forEach((header, i) => {
        doc.text(header.substring(0, 45), xPos2 + 2, doc.page.margins.top + 4, {
          width: colWidths[i] - 4,
          align: "center",
        });
        xPos2 += colWidths[i];
      });
      doc.fillColor("#000000").fontSize(8).font("Helvetica");
      doc.y = doc.page.margins.top + headerHeight;
      return true;
    }
    return false;
  };

  // Headers
  const headerY = startY !== undefined ? startY : doc.y;
  if (headerY + headerHeight > doc.page.height - doc.page.margins.bottom - 30) {
    doc.addPage();
    return addPDFTable(doc, headers, rows, colWidths, doc.page.margins.top);
  }

  doc.rect(startX, headerY, totalWidth, headerHeight).fill("#4472C4");
  doc.fillColor("#FFFFFF").fontSize(8).font("Helvetica-Bold");

  let xPos = startX;
  headers.forEach((header, i) => {
    doc.text(header.substring(0, 45), xPos + 2, headerY + 4, {
      width: colWidths[i] - 4,
      align: "center",
    });
    xPos += colWidths[i];
  });

  doc.y = headerY + headerHeight;

  // Rows
  doc.fillColor("#000000").fontSize(8).font("Helvetica");
  rows.forEach((row, rowIndex) => {
    needsNewPage(rowHeight);

    const rowY = doc.y;

    if (rowIndex % 2 === 0) {
      doc.rect(startX, rowY, totalWidth, rowHeight).fill("#F5F5F5");
    }

    doc.fillColor("#000000");
    xPos = startX;
    headers.forEach((header, i) => {
      const val = row[header];
      let text = "";
      if (val === null || val === undefined) {
        text = "";
      } else if (typeof val === "object") {
        text = JSON.stringify(val).substring(0, 45);
      } else if (typeof val === "number" && (header.toLowerCase().includes("monto") || header.toLowerCase().includes("ventas") || header.toLowerCase().includes("total") || header.toLowerCase().includes("pipeline") || header.toLowerCase().includes("promedio") || header.toLowerCase().includes("precio") || header.toLowerCase().includes("compras"))) {
        text = formatCurrency(val);
      } else {
        text = String(val).substring(0, 45);
      }
      doc.text(text, xPos + 2, rowY + 3, {
        width: colWidths[i] - 4,
        align: "center",
      });
      xPos += colWidths[i];
    });

    doc.y = rowY + rowHeight;
  });

  doc.moveDown(1);
}

// Generar PDF multi-sección
async function generatePDFMultiSection(reportType: string, data: any, filters?: Record<string, any>): Promise<Buffer> {
  return new Promise((resolve) => {
    const useLandscape = reportType === "dashboard" || reportType === "opportunities";
    const doc = new PDFDocument({
      margin: 40,
      size: "letter",
      layout: useLandscape ? "landscape" : "portrait",
    });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    const flattened = flattenReportData(reportType, data);
    const reportTitle = translateReportTitle(reportType);
    const now = new Date();
    const filtersDisplay = formatFiltersForDisplay(filters);

    // =====================
    // PÁGINA DE PORTADA
    // =====================
    const pageW = doc.page.width;
    const pageH = doc.page.height;

    // Fondo azul superior
    doc.fillColor("#1e3a5f").rect(0, 0, pageW, 180).fill();

    // Logo / Título
    doc.fillColor("#FFFFFF").fontSize(28).font("Helvetica-Bold").text("RETFlow CRM", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(16).font("Helvetica").text(reportTitle, { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(10).font("Helvetica").text(`Generado el ${now.toLocaleDateString("es-MX", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`, { align: "center" });
    doc.fontSize(10).text(`a las ${now.toLocaleTimeString("es-MX")}`, { align: "center" });

    // Línea separadora
    doc.moveDown(1.5);
    const lineY = doc.y;
    doc.strokeColor("#4472C4").lineWidth(2)
      .moveTo(pageW * 0.2, lineY)
      .lineTo(pageW * 0.8, lineY)
      .stroke();

    // Filtros aplicados en portada
    if (filtersDisplay.length > 0) {
      doc.moveDown(1);
      doc.fontSize(12).font("Helvetica-Bold").fillColor("#1e3a5f").text("Filtros Aplicados", { align: "center" });
      doc.moveDown(0.5);
      doc.fontSize(9).font("Helvetica").fillColor("#333333");
      const colWidth = (pageW - 160) / 2;
      let col = 0;
      let rowY = doc.y;
      const startX = 80;
      filtersDisplay.forEach((f, i) => {
        const x = startX + col * colWidth;
        if (i > 0 && col === 0) rowY = doc.y;
        doc.fontSize(8).font("Helvetica-Bold").fillColor("#666666").text(`${f.label}:`, x, rowY + (i > 0 && col === 0 ? 0 : 0), { width: colWidth * 0.35, align: "right" });
        doc.fontSize(8).font("Helvetica").fillColor("#333333").text(f.value, x + colWidth * 0.38, rowY + (i > 0 && col === 0 ? 0 : 0), { width: colWidth * 0.62 });
        col = (col + 1) % 2;
        if (col === 0) doc.moveDown(0.8);
      });
    }

    // Pie de portada
    doc.fillColor("#999999").fontSize(8).font("Helvetica").text(
      `© ${now.getFullYear()} RETFlow CRM — Todos los derechos reservados`,
      0, pageH - 50, { align: "center", width: pageW }
    );

    // =====================
    // PÁGINA: TABLA DE CONTENIDO
    // =====================
    doc.addPage();
    doc.fontSize(16).font("Helvetica-Bold").fillColor("#1e3a5f").text("Contenido", { align: "center" });
    doc.moveDown(1);
    doc.strokeColor("#4472C4").lineWidth(1)
      .moveTo(60, doc.y)
      .lineTo(pageW - 60, doc.y)
      .stroke();
    doc.moveDown(0.5);

    const sections: string[] = [];
    if (flattened.summary.length > 0) sections.push("Resumen / KPIs");
    flattened.charts.forEach((c) => sections.push(c.name));
    if (flattened.detail.length > 0) sections.push("Datos Detallados");
    if (filtersDisplay.length > 0) sections.push("Filtros Aplicados");

    doc.fontSize(10).font("Helvetica").fillColor("#333333");
    sections.forEach((section, i) => {
      doc.fontSize(10).text(`${i + 1}.  ${section}`, 80, doc.y, { width: pageW - 160 });
      doc.moveDown(0.6);
    });

    // =====================
    // SECCIÓN: Resumen / KPIs
    // =====================
    doc.addPage();
    if (flattened.summary.length > 0) {
      doc.fontSize(14).font("Helvetica-Bold").fillColor("#1e3a5f").text("Resumen / KPIs", { underline: true });
      doc.moveDown(0.5);
      const headers = Object.keys(flattened.summary[0]);
      const colWidths = calculatePDFColWidths(headers, flattened.summary.length, doc.page.width, 80);
      addPDFTable(doc, headers, flattened.summary, colWidths);
      doc.moveDown(1);
    }

    // =====================
    // SECCIÓN: Gráficos como tablas
    // =====================
    for (const chart of flattened.charts) {
      if (chart.data.length > 0) {
        if (doc.y > doc.page.height - 150) {
          doc.addPage();
        }
        doc.fontSize(12).font("Helvetica-Bold").fillColor("#1e3a5f").text(chart.name, { underline: true });
        doc.moveDown(0.5);
        const headers = Object.keys(chart.data[0]);
        const colWidths = calculatePDFColWidths(headers, chart.data.length, doc.page.width, 80);
        addPDFTable(doc, headers, chart.data.slice(0, 50), colWidths);
        doc.moveDown(1);
      }
    }

    // =====================
    // SECCIÓN: Datos detallados
    // =====================
    if (flattened.detail.length > 0) {
      if (doc.y > doc.page.height - 100) {
        doc.addPage();
      }
      doc.fontSize(14).font("Helvetica-Bold").fillColor("#1e3a5f").text("Datos Detallados", { underline: true });
      doc.moveDown(0.5);
      const headers = Object.keys(flattened.detail[0]);
      const colWidths = calculatePDFColWidths(headers, Math.min(flattened.detail.length, 50), doc.page.width, 80);
      addPDFTable(doc, headers, flattened.detail.slice(0, 300), colWidths);
    }

    // =====================
    // SECCIÓN: Filtros aplicados
    // =====================
    if (filtersDisplay.length > 0) {
      if (doc.y > doc.page.height - 120) {
        doc.addPage();
      }
      doc.fontSize(12).font("Helvetica-Bold").fillColor("#1e3a5f").text("Filtros Aplicados", { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(9).font("Helvetica").fillColor("#333333");
      filtersDisplay.forEach((f) => {
        doc.text(`${f.label}: ${f.value}`);
      });
    }

    // =====================
    // FOOTER FINAL
    // =====================
    doc.moveDown(2);
    doc.fontSize(8).fillColor("#999999").text(
      `© ${now.getFullYear()} RETFlow CRM — Todos los derechos reservados`,
      { align: "center" }
    );

    doc.end();
  });
}

// Generar Excel multi-hoja
async function generateExcelMultiSheet(reportType: string, data: any, filters?: Record<string, any>): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const flattened = flattenReportData(reportType, data);
  const reportTitle = translateReportTitle(reportType);
  const now = new Date();
  const filtersDisplay = formatFiltersForDisplay(filters);

  // =====================
  // HOJA 1: PORTADA
  // =====================
  const coverWs = workbook.addWorksheet("Portada", { properties: { tabColor: { argb: "FF1E3A5F" } } });

  // Ocultar gridlines
  coverWs.views = [{ showGridLines: false }];

  // Fondo azul superior
  for (let col = 1; col <= 10; col++) {
    for (let row = 1; row <= 5; row++) {
      coverWs.getCell(row, col).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
    }
  }

  // Título
  coverWs.getCell(2, 1).value = "RETFlow CRM";
  coverWs.getCell(2, 1).font = { bold: true, size: 28, color: { argb: "FFFFFFFF" } };
  coverWs.mergeCells(2, 1, 2, 6);
  coverWs.getCell(2, 1).alignment = { horizontal: "center", vertical: "middle" };

  // Subtítulo
  coverWs.getCell(3, 1).value = reportTitle;
  coverWs.getCell(3, 1).font = { size: 16, color: { argb: "FFD0D0D0" } };
  coverWs.mergeCells(3, 1, 3, 6);
  coverWs.getCell(3, 1).alignment = { horizontal: "center", vertical: "middle" };

  // Fecha
  coverWs.getCell(4, 1).value = `Generado el ${now.toLocaleDateString("es-MX", { weekday: "long", year: "numeric", month: "long", day: "numeric" })} a las ${now.toLocaleTimeString("es-MX")}`;
  coverWs.getCell(4, 1).font = { size: 10, color: { argb: "FFB0B0B0" }, italic: true };
  coverWs.mergeCells(4, 1, 4, 6);
  coverWs.getCell(4, 1).alignment = { horizontal: "center", vertical: "middle" };

  // Filtros aplicados
  if (filtersDisplay.length > 0) {
    let row = 7;
    coverWs.getCell(row, 1).value = "Filtros Aplicados";
    coverWs.getCell(row, 1).font = { bold: true, size: 12, color: { argb: "FF1E3A5F" } };
    coverWs.mergeCells(row, 1, row, 3);
    row++;

    // Encabezados de tabla de filtros
    coverWs.getCell(row, 1).value = "Filtro";
    coverWs.getCell(row, 2).value = "Valor";
    coverWs.getRow(row).font = { bold: true, size: 10 };
    coverWs.getRow(row).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4472C4" } };
    coverWs.getRow(row).font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    row++;

    filtersDisplay.forEach((f) => {
      coverWs.getCell(row, 1).value = f.label;
      coverWs.getCell(row, 1).font = { bold: true, size: 10 };
      coverWs.getCell(row, 2).value = f.value;
      coverWs.getCell(row, 2).font = { size: 10 };
      row++;
    });
  }

  // Pie
  const lastRow = Math.max(18, coverWs.rowCount + 2);
  coverWs.getCell(lastRow, 1).value = `© ${now.getFullYear()} RETFlow CRM — Todos los derechos reservados`;
  coverWs.getCell(lastRow, 1).font = { size: 8, color: { argb: "FF999999" }, italic: true };
  coverWs.mergeCells(lastRow, 1, lastRow, 6);
  coverWs.getCell(lastRow, 1).alignment = { horizontal: "center" };

  // Anchos de columnas portada
  coverWs.getColumn(1).width = 25;
  coverWs.getColumn(2).width = 35;

  // =====================
  // HELPER: Agregar hoja con formato
  // =====================
  function addFormattedSheet(name: string, headers: string[], rows: any[]) {
    if (rows.length === 0) return;
    const ws = workbook.addWorksheet(name.substring(0, 31), { properties: { tabColor: { argb: "FF4472C4" } } });

    // Headers
    ws.columns = headers.map((h) => ({
      header: h,
      key: h,
    }));

    // Header styling
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4472C4" } };
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    ws.getRow(1).alignment = { vertical: "middle", horizontal: "center" };
    ws.getRow(1).height = 22;
    ws.views = [{ state: "frozen", ySplit: 1 }];

    // Rows
    rows.forEach((row, i) => {
      const rowNum = i + 2;
      const serialized: any = {};
      for (const [key, value] of Object.entries(row)) {
        if (value === null || value === undefined) {
          serialized[key] = "";
        } else if (typeof value === "object" && !(value instanceof Date)) {
          serialized[key] = JSON.stringify(value);
        } else {
          serialized[key] = value;
        }
      }
      const excelRow = ws.addRow(serialized);
      if (i % 2 === 0) {
        excelRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F5F5" } };
      }
      excelRow.alignment = { vertical: "middle" };

      // Aplicar formato de moneda/porcentaje/fecha
      for (const [key, value] of Object.entries(row)) {
        if (value === null || value === undefined) continue;
        const cell = excelRow.getCell(key);
        if (typeof value === "number") {
          if (isCurrencyColumn(key)) {
            cell.numFmt = '$#,##0.00';
          } else if (isPercentageColumn(key)) {
            cell.numFmt = '0.0"%"';
          }
        } else if (value instanceof Date) {
          cell.numFmt = 'DD/MM/YYYY';
        } else if (typeof value === "string" && !isNaN(Date.parse(value)) && isDateColumn(key)) {
          try {
            cell.value = new Date(value);
            cell.numFmt = 'DD/MM/YYYY';
          } catch { /* ignore */ }
        }
      }
    });

    // Auto-width
    ws.columns.forEach((col: any) => {
      if (col) {
        let maxLen = col.header ? col.header.length : 10;
        col.eachCell?.({ includeEmpty: false }, (cell: any) => {
          maxLen = Math.max(maxLen, String(cell.value).length);
        });
        col.width = Math.min(maxLen + 4, 45);
      }
    });
  }

  // =====================
  // HOJA: Resumen
  // =====================
  if (flattened.summary.length > 0) {
    addFormattedSheet("Resumen", Object.keys(flattened.summary[0]), flattened.summary);
  }

  // =====================
  // HOJAS: Gráficos
  // =====================
  for (const chart of flattened.charts) {
    if (chart.data.length > 0) {
      addFormattedSheet(chart.name.substring(0, 31), Object.keys(chart.data[0]), chart.data);
    }
  }

  // =====================
  // HOJA: Datos detallados
  // =====================
  if (flattened.detail.length > 0) {
    addFormattedSheet("Datos", Object.keys(flattened.detail[0]), flattened.detail);
  }

  // Si no hay datos, crear hoja vacía con mensaje
  if (workbook.worksheets.length === 1) {
    const ws = workbook.addWorksheet("Sin datos");
    ws.getCell("A1").value = "No hay datos disponibles para este reporte";
    ws.getCell("A1").font = { italic: true, color: { argb: "FF999999" }, size: 12 };
  }

  return await workbook.xlsx.writeBuffer();
}

export async function exportReportHandler(req: Request, res: Response): Promise<void> {
  if (!hasPermission(req, PERMISSIONS.REPORTS_EXPORT)) {
    res.status(403).json(abcError("No tiene permisos para exportar reportes"));
    return;
  }

  try {
    const input = exportReportSchema.parse(req.body ?? {});

    // Filtros por defecto si no se proporcionan
    const defaultFilters = { SEARCH: "" };
    const filters = input.FILTERS ? { ...defaultFilters, ...input.FILTERS } : defaultFilters;

    // Obtener datos según el tipo de reporte
    let data: any;
    switch (input.REPORT_TYPE) {
      case "dashboard":
        data = await getDashboardExecutive(req.auth!.companyId, req.auth!.userId, filters);
        break;
      case "sales":
        data = await getSalesReport(req.auth!.companyId, req.auth!.userId, filters);
        break;
      case "customers":
        data = await getCustomersReport(req.auth!.companyId, req.auth!.userId, filters);
        break;
      case "activities":
        data = await getActivitiesReport(req.auth!.companyId, req.auth!.userId, filters);
        break;
      case "opportunities":
        data = await getOpportunitiesReport(req.auth!.companyId, req.auth!.userId, filters);
        break;
      case "products":
        data = await getProductsReport(req.auth!.companyId, req.auth!.userId, filters);
        break;
      default:
        res.status(400).json(abcError("Tipo de reporte no válido"));
        return;
    }

    // Generar archivo según formato
    if (input.FORMAT === "excel") {
      const buffer = await generateExcelMultiSheet(input.REPORT_TYPE, data, filters);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="reporte_${input.REPORT_TYPE}_${new Date().toISOString().split("T")[0]}.xlsx"`);
      res.send(buffer);
    } else if (input.FORMAT === "pdf") {
      const pdfBuffer = await generatePDFMultiSection(input.REPORT_TYPE, data, filters);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="reporte_${input.REPORT_TYPE}_${new Date().toISOString().split("T")[0]}.pdf"`);
      res.send(pdfBuffer);
    } else if (input.FORMAT === "csv") {
      const flattened = flattenReportData(input.REPORT_TYPE, data);
      const allData = [...flattened.summary, ...flattened.detail];
      if (allData.length > 0) {
        const headers = Object.keys(allData[0]);
        const csvRows = [
          headers.join(","),
          ...allData.map((row: any) =>
            headers.map((h) => {
              const val = row[h];
              if (val === null || val === undefined) return "";
              if (typeof val === "object") return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
              if (typeof val === "string" && val.includes(",")) return `"${val}"`;
              return String(val);
            }).join(",")
          ),
        ].join("\n");

        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="reporte_${input.REPORT_TYPE}_${new Date().toISOString().split("T")[0]}.csv"`);
        res.send("\uFEFF" + csvRows);
      } else {
        res.status(400).json(abcError("No hay datos para exportar"));
      }
    } else {
      res.json({
        resultado: 1,
        msg: `Reporte ${input.REPORT_TYPE} generado correctamente`,
        format: input.FORMAT,
        data,
      });
    }

    // Audit logging
    try {
      const pool = await getPool();
      await pool
        .request()
        .input("company_id", sql.Int, req.auth!.companyId)
        .input("user_id", sql.Int, req.auth!.userId)
        .input("report_type", sql.VarChar(50), input.REPORT_TYPE)
        .input("format", sql.VarChar(10), input.FORMAT)
        .input("filters", sql.NVarChar(sql.MAX), JSON.stringify(filters))
        .query(`
          INSERT INTO crm.report_logs (company_id, user_id, report_type, format, filters, generated_at)
          VALUES (@company_id, @user_id, @report_type, @format, @filters, SYSUTCDATETIME());
        `);
    } catch (logError) {
      logger.warn({ logError }, "Error al escribir registro de auditoría para exportación de reporte");
    }
  } catch (error: any) {
    if (error.name === "ZodError") {
      res.status(400).json({ resultado: -1, msg: "Datos inválidos", errors: error.errors });
    } else {
      res.status(500).json(abcError("Error al exportar reporte"));
    }
  }
}

// ============================================
// VISTAS GUARDADAS
// ============================================

export async function getSavedViewsHandler(req: Request, res: Response): Promise<void> {
  if (!hasPermission(req, PERMISSIONS.REPORTS_SAVED_VIEWS)) {
    res.status(403).json(abcError("No tiene permisos para ver vistas guardadas"));
    return;
  }

  try {
    const views = await getSavedViews(req.auth!.companyId, req.auth!.userId);
    res.json({ resultado: 1, data: views });
  } catch (error: any) {
    res.status(500).json(abcError("Error al obtener vistas guardadas"));
  }
}

export async function createSavedViewHandler(req: Request, res: Response): Promise<void> {
  if (!hasPermission(req, PERMISSIONS.REPORTS_SAVED_VIEWS)) {
    res.status(403).json(abcError("No tiene permisos para crear vistas guardadas"));
    return;
  }

  try {
    const input = savedViewSchema.parse(req.body ?? {});
    const viewId = await createSavedView(req.auth!.companyId, req.auth!.userId, {
      viewName: input.VIEW_NAME,
      reportType: input.REPORT_TYPE,
      filters: input.FILTERS,
      isDefault: input.IS_DEFAULT,
    });
    res.json({ resultado: 1, msg: "Vista guardada creada correctamente", view_id: viewId });
  } catch (error: any) {
    if (error.name === "ZodError") {
      res.status(400).json({ resultado: -1, msg: "Datos inválidos", errors: error.errors });
    } else {
      res.status(500).json(abcError("Error al crear vista guardada"));
    }
  }
}

export async function updateSavedViewHandler(req: Request, res: Response): Promise<void> {
  if (!hasPermission(req, PERMISSIONS.REPORTS_SAVED_VIEWS)) {
    res.status(403).json(abcError("No tiene permisos para actualizar vistas guardadas"));
    return;
  }

  try {
    const viewId = Number(req.params.id);
    const input = savedViewUpdateSchema.parse(req.body ?? {});

    await updateSavedView(req.auth!.companyId, req.auth!.userId, viewId, {
      viewName: input.VIEW_NAME,
      filters: input.FILTERS,
      isDefault: input.IS_DEFAULT,
    });

    res.json(abcSuccess("Vista actualizada correctamente"));
  } catch (error: any) {
    if (error.name === "ZodError") {
      res.status(400).json({ resultado: -1, msg: "Datos inválidos", errors: error.errors });
    } else if (error.message === "Vista no encontrada") {
      res.status(404).json(abcError("Vista no encontrada"));
    } else {
      res.status(500).json(abcError("Error al actualizar vista"));
    }
  }
}

export async function deleteSavedViewHandler(req: Request, res: Response): Promise<void> {
  if (!hasPermission(req, PERMISSIONS.REPORTS_SAVED_VIEWS)) {
    res.status(403).json(abcError("No tiene permisos para eliminar vistas guardadas"));
    return;
  }

  try {
    const viewId = Number(req.params.id);
    await deleteSavedView(req.auth!.companyId, req.auth!.userId, viewId);
    res.json(abcSuccess("Vista eliminada correctamente"));
  } catch (error: any) {
    res.status(500).json(abcError("Error al eliminar vista"));
  }
}

// ============================================
// REPORTES PROGRAMADOS
// ============================================

export async function getScheduledReportsHandler(req: Request, res: Response): Promise<void> {
  if (!hasPermission(req, PERMISSIONS.REPORTS_SCHEDULED)) {
    res.status(403).json(abcError("No tiene permisos para ver reportes programados"));
    return;
  }

  try {
    const reports = await getScheduledReports(req.auth!.companyId, req.auth!.userId);
    res.json({ resultado: 1, data: reports });
  } catch (error: any) {
    res.status(500).json(abcError("Error al obtener reportes programados"));
  }
}

export async function createScheduledReportHandler(req: Request, res: Response): Promise<void> {
  if (!hasPermission(req, PERMISSIONS.REPORTS_SCHEDULED)) {
    res.status(403).json(abcError("No tiene permisos para crear reportes programados"));
    return;
  }

  try {
    const input = scheduledReportSchema.parse(req.body ?? {});
    const scheduleId = await createScheduledReport(req.auth!.companyId, req.auth!.userId, {
      reportType: input.REPORT_TYPE,
      frequency: input.FREQUENCY,
      dayOfWeek: input.DAY_OF_WEEK ?? undefined,
      dayOfMonth: input.DAY_OF_MONTH ?? undefined,
      recipients: input.RECIPIENTS,
      filters: input.FILTERS,
      isActive: input.IS_ACTIVE,
    });
    res.json({ resultado: 1, msg: "Reporte programado creado correctamente", schedule_id: scheduleId });
  } catch (error: any) {
    if (error.name === "ZodError") {
      res.status(400).json({ resultado: -1, msg: "Datos inválidos", errors: error.errors });
    } else {
      res.status(500).json(abcError("Error al crear reporte programado"));
    }
  }
}

export async function updateScheduledReportHandler(req: Request, res: Response): Promise<void> {
  if (!hasPermission(req, PERMISSIONS.REPORTS_SCHEDULED)) {
    res.status(403).json(abcError("No tiene permisos para actualizar reportes programados"));
    return;
  }

  try {
    const scheduleId = Number(req.params.id);
    const input = scheduledReportUpdateSchema.parse(req.body ?? {});

    await updateScheduledReport(req.auth!.companyId, req.auth!.userId, scheduleId, {
      frequency: input.FREQUENCY,
      dayOfWeek: input.DAY_OF_WEEK ?? undefined,
      dayOfMonth: input.DAY_OF_MONTH ?? undefined,
      recipients: input.RECIPIENTS,
      filters: input.FILTERS,
      isActive: input.IS_ACTIVE,
    });

    res.json(abcSuccess("Reporte programado actualizado correctamente"));
  } catch (error: any) {
    if (error.name === "ZodError") {
      res.status(400).json({ resultado: -1, msg: "Datos inválidos", errors: error.errors });
    } else if (error.message === "Reporte programado no encontrado") {
      res.status(404).json(abcError("Reporte programado no encontrado"));
    } else {
      res.status(500).json(abcError("Error al actualizar reporte programado"));
    }
  }
}

export async function deleteScheduledReportHandler(req: Request, res: Response): Promise<void> {
  if (!hasPermission(req, PERMISSIONS.REPORTS_SCHEDULED)) {
    res.status(403).json(abcError("No tiene permisos para eliminar reportes programados"));
    return;
  }

  try {
    const scheduleId = Number(req.params.id);
    await deleteScheduledReport(req.auth!.companyId, req.auth!.userId, scheduleId);
    res.json(abcSuccess("Reporte programado eliminado correctamente"));
  } catch (error: any) {
    res.status(500).json(abcError("Error al eliminar reporte programado"));
  }
}