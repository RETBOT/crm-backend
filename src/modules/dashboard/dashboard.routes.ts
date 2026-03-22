import { Router } from "express";
import { getDashboardHome, getDashboardOverdue } from "./dashboard.controller";

const router = Router();

router.get("/home", getDashboardHome);
router.get("/overdue", getDashboardOverdue);

export { router as dashboardRoutes };
