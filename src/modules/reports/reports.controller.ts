import { Request, Response } from "express";
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

    // Por ahora retornamos los datos en JSON
    // TODO: Implementar exportación real a Excel/PDF
    res.json({
      resultado: 1,
      msg: `Reporte ${input.REPORT_TYPE} generado correctamente`,
      format: input.FORMAT,
      data,
    });
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