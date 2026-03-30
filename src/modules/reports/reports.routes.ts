import { Router } from "express";
import {
  getDashboardHandler,
  getSalesReportHandler,
  getCustomersReportHandler,
  getActivitiesReportHandler,
  getOpportunitiesReportHandler,
  getProductsReportHandler,
  exportReportHandler,
  getSavedViewsHandler,
  createSavedViewHandler,
  updateSavedViewHandler,
  deleteSavedViewHandler,
  getScheduledReportsHandler,
  createScheduledReportHandler,
  updateScheduledReportHandler,
  deleteScheduledReportHandler,
} from "./reports.controller";

const router = Router();

// ============================================
// REPORTES PRINCIPALES
// ============================================
router.post("/dashboard", getDashboardHandler);
router.post("/sales", getSalesReportHandler);
router.post("/customers", getCustomersReportHandler);
router.post("/activities", getActivitiesReportHandler);
router.post("/opportunities", getOpportunitiesReportHandler);
router.post("/products", getProductsReportHandler);

// ============================================
// EXPORTACIÓN
// ============================================
router.post("/export", exportReportHandler);

// ============================================
// VISTAS GUARDADAS
// ============================================
router.get("/saved-views", getSavedViewsHandler);
router.post("/saved-views", createSavedViewHandler);
router.put("/saved-views/:id", updateSavedViewHandler);
router.delete("/saved-views/:id", deleteSavedViewHandler);

// ============================================
// REPORTES PROGRAMADOS
// ============================================
router.get("/scheduled", getScheduledReportsHandler);
router.post("/scheduled", createScheduledReportHandler);
router.put("/scheduled/:id", updateScheduledReportHandler);
router.delete("/scheduled/:id", deleteScheduledReportHandler);

export { router as reportsRoutes };