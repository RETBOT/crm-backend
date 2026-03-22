import { Router } from "express";
import { getDashboardHome } from "./dashboard.controller";

const router = Router();

router.get("/home", getDashboardHome);

export { router as dashboardRoutes };
