import { Request, Response } from "express";
import { getPool, sql } from "../../db/sqlserver";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
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
    logger.error({ error, body: req.body }, "Error getting dashboard");
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
    logger.error({ error, body: req.body }, "Error getting sales report");
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
    logger.error({ error, body: req.body }, "Error getting customers report");
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
    logger.error({ error, body: req.body }, "Error getting activities report");
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
    logger.error({ error, body: req.body }, "Error getting opportunities report");
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
    logger.error({ error, body: req.body }, "Error getting products report");
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
          métrica: key.replace(/_/g, " ").toUpperCase(),
          actual: value.current ?? "",
          anterior: value.previous ?? "",
          cambio: value.change ? `${value.change > 0 ? "+" : ""}${value.change.toFixed(1)}%` : "",
        });
      }
    }
  }
  if (data.charts) {
    for (const [name, chartData] of Object.entries(data.charts as Record<string, any>)) {
      if (Array.isArray(chartData) && chartData.length > 0) {
        result.charts.push({ name: name.replace(/_/g, " ").toUpperCase(), data: chartData });
      }
    }
  }

  // Reports with data array: { data: [...], totals: {...} }
  if (Array.isArray(data.data)) {
    result.detail = data.data;
    if (data.totals) {
      result.summary = Object.entries(data.totals).map(([key, value]) => ({
        métrica: key.replace(/_/g, " ").toUpperCase(),
        valor: typeof value === "number" ? value.toLocaleString("es-MX") : String(value),
      }));
    }
  }

  // Fallback: si no hay estructura conocida, convertir todo en detalle
  if (result.detail.length === 0 && result.summary.length === 0 && result.charts.length === 0) {
    if (Array.isArray(data)) {
      result.detail = data;
    } else if (typeof data === "object") {
      result.detail = Object.entries(data).map(([key, value]) => ({
        campo: key,
        valor: typeof value === "object" ? JSON.stringify(value) : String(value),
      }));
    }
  }

  return result;
}

// Helper: Calcular anchos de columna para PDF
function calculatePDFColWidths(headers: string[], rowCount: number, pageWidth: number, margins: number) {
  const availableWidth = pageWidth - margins;
  const baseWidth = availableWidth / headers.length;
  // Limitar entre 40 y 150px
  return headers.map(() => Math.max(40, Math.min(baseWidth, 150)));
}

// Helper: Agregar tabla al PDF
function addPDFTable(doc: any, headers: string[], rows: any[], colWidths: number[], startY?: number) {
  const rowHeight = 16;
  const totalWidth = colWidths.reduce((a, b) => a + b, 0);
  const startX = (doc.page.width - doc.page.margins.left - doc.page.margins.right - totalWidth) / 2 + doc.page.margins.left;

  // Headers
  const headerY = startY !== undefined ? startY : doc.y;
  if (headerY + rowHeight > doc.page.height - doc.page.margins.bottom - 20) {
    doc.addPage();
    return addPDFTable(doc, headers, rows, colWidths, doc.page.margins.top);
  }

  doc.rect(startX, headerY, totalWidth, rowHeight).fill("#4472C4");
  doc.fillColor("#FFFFFF").fontSize(7).font("Helvetica-Bold");

  let xPos = startX;
  headers.forEach((header, i) => {
    doc.text(header.substring(0, 20), xPos + 2, headerY + 3, {
      width: colWidths[i] - 4,
      align: "center",
    });
    xPos += colWidths[i];
  });

  // Rows
  doc.fillColor("#000000").fontSize(7).font("Helvetica");
  rows.forEach((row, rowIndex) => {
    const y = doc.y;
    if (y + rowHeight > doc.page.height - doc.page.margins.bottom - 20) {
      doc.addPage();
      doc.rect(startX, doc.page.margins.top, totalWidth, rowHeight).fill("#4472C4");
      doc.fillColor("#FFFFFF").fontSize(7).font("Helvetica-Bold");
      xPos = startX;
      headers.forEach((header, i) => {
        doc.text(header.substring(0, 20), xPos + 2, doc.page.margins.top + 3, {
          width: colWidths[i] - 4,
          align: "center",
        });
        xPos += colWidths[i];
      });
      doc.fillColor("#000000").fontSize(7).font("Helvetica");
      doc.y = doc.page.margins.top + rowHeight;
    }

    if (rowIndex % 2 === 0) {
      doc.rect(startX, doc.y, totalWidth, rowHeight).fill("#F5F5F5");
    }

    doc.fillColor("#000000");
    xPos = startX;
    headers.forEach((header, i) => {
      const val = row[header];
      const text = val === null || val === undefined ? "" :
                   typeof val === "object" ? JSON.stringify(val).substring(0, 20) : String(val).substring(0, 20);
      doc.text(text, xPos + 2, doc.y + 2, {
        width: colWidths[i] - 4,
        align: "center",
      });
      xPos += colWidths[i];
    });

    doc.y += rowHeight;
  });

  doc.moveDown(1);
}

// Generar PDF multi-sección
async function generatePDFMultiSection(reportType: string, data: any): Promise<Buffer> {
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

    // Header
    doc.fontSize(20).font("Helvetica-Bold").text("RETFlow CRM", { align: "center" });
    doc.fontSize(12).font("Helvetica").text(`Reporte: ${reportType.toUpperCase()}`, { align: "center" });
    doc.fontSize(9).text(`Generado: ${new Date().toLocaleString("es-MX")}`, { align: "center" });
    doc.moveDown(1);

    // Sección: Resumen / KPIs
    if (flattened.summary.length > 0) {
      doc.fontSize(14).font("Helvetica-Bold").text("Resumen", { underline: true });
      doc.moveDown(0.5);
      const headers = Object.keys(flattened.summary[0]);
      const colWidths = calculatePDFColWidths(headers, flattened.summary.length, doc.page.width, 80);
      addPDFTable(doc, headers, flattened.summary, colWidths);
      doc.moveDown(1);
    }

    // Sección: Gráficos como tablas
    for (const chart of flattened.charts) {
      if (chart.data.length > 0) {
        // Verificar si necesitamos nueva página
        if (doc.y > doc.page.height - 150) {
          doc.addPage();
        }
        doc.fontSize(12).font("Helvetica-Bold").text(chart.name, { underline: true });
        doc.moveDown(0.5);
        const headers = Object.keys(chart.data[0]);
        const colWidths = calculatePDFColWidths(headers, chart.data.length, doc.page.width, 80);
        addPDFTable(doc, headers, chart.data.slice(0, 20), colWidths); // Máx 20 filas por chart
        doc.moveDown(1);
      }
    }

    // Sección: Datos detallados
    if (flattened.detail.length > 0) {
      if (doc.y > doc.page.height - 100) {
        doc.addPage();
      }
      doc.fontSize(14).font("Helvetica-Bold").text("Datos Detallados", { underline: true });
      doc.moveDown(0.5);
      const headers = Object.keys(flattened.detail[0]);
      const colWidths = calculatePDFColWidths(headers, Math.min(flattened.detail.length, 50), doc.page.width, 80);
      addPDFTable(doc, headers, flattened.detail.slice(0, 100), colWidths); // Máx 100 filas
    }

    // Footer simple al final
    doc.moveDown(1);
    doc.fontSize(7).text(
      `© ${new Date().getFullYear()} RETFlow CRM — Todos los derechos reservados`,
      { align: "center" }
    );

    doc.end();
  });
}

// Generar Excel multi-hoja
async function generateExcelMultiSheet(reportType: string, data: any): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const flattened = flattenReportData(reportType, data);

  // Función helper para agregar hoja con formato
  function addFormattedSheet(name: string, headers: string[], rows: any[]) {
    if (rows.length === 0) return;
    const ws = workbook.addWorksheet(name.substring(0, 31)); // Max 31 chars

    // Headers
    ws.columns = headers.map((h) => ({
      header: h.replace(/_/g, " ").toUpperCase(),
      key: h,
    }));

    // Header styling
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4472C4" } };
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    ws.getRow(1).alignment = { vertical: "middle", horizontal: "center" };
    ws.views = [{ state: "frozen", ySplit: 1 }];

    // Rows
    rows.forEach((row, i) => {
      const rowNum = i + 2;
      const serialized: any = {};
      for (const [key, value] of Object.entries(row)) {
        serialized[key] = value === null || value === undefined ? "" :
                          typeof value === "object" ? JSON.stringify(value) : value;
      }
      const excelRow = ws.addRow(serialized);
      if (i % 2 === 0) {
        excelRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F5F5" } };
      }
      excelRow.alignment = { vertical: "middle" };
    });

    // Auto-width
    ws.columns.forEach((col: any) => {
      if (col) {
        let maxLen = 10;
        col.eachCell?.({ includeEmpty: false }, (cell: any) => {
          maxLen = Math.max(maxLen, String(cell.value).length);
        });
        col.width = Math.min(maxLen + 4, 40);
      }
    });
  }

  // Hoja 1: Resumen
  if (flattened.summary.length > 0) {
    addFormattedSheet("Resumen", Object.keys(flattened.summary[0]), flattened.summary);
  }

  // Hojas 2+: Gráficos
  for (const chart of flattened.charts) {
    if (chart.data.length > 0) {
      addFormattedSheet(chart.name.substring(0, 31), Object.keys(chart.data[0]), chart.data);
    }
  }

  // Hoja final: Datos detallados
  if (flattened.detail.length > 0) {
    addFormattedSheet("Datos", Object.keys(flattened.detail[0]), flattened.detail);
  }

  // Si no hay datos, crear hoja vacía con mensaje
  if (workbook.worksheets.length === 0) {
    const ws = workbook.addWorksheet("Sin datos");
    ws.getCell("A1").value = "No hay datos disponibles para este reporte";
    ws.getCell("A1").font = { italic: true, color: { argb: "FF999999" } };
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
      const buffer = await generateExcelMultiSheet(input.REPORT_TYPE, data);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="reporte_${input.REPORT_TYPE}_${new Date().toISOString().split("T")[0]}.xlsx"`);
      res.send(buffer);
    } else if (input.FORMAT === "pdf") {
      const pdfBuffer = await generatePDFMultiSection(input.REPORT_TYPE, data);
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
      logger.warn({ logError }, "Failed to write audit log for report export");
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