import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { getPool } from "./db/sqlserver";
import { authRoutes } from "./modules/auth/auth.routes";
import { adminRoutes } from "./modules/admin/admin.routes";
import { requireAuth } from "./middlewares/auth";
import { catalogRoutes } from "./modules/catalog/catalog.routes";
import { customersRoutes } from "./modules/customers/customers.routes";
import { dashboardRoutes } from "./modules/dashboard/dashboard.routes";
import { activitiesRoutes } from "./modules/activities/activities.routes";
import { opportunitiesRoutes } from "./modules/opportunities/opportunities.routes";
import { productsRoutes } from "./modules/products/products.routes";
import { notificationsRoutes } from "./modules/notifications/notifications.routes";
import { reportsRoutes } from "./modules/reports/reports.routes";
import { profileRoutes } from "./modules/profile/profile.routes";
import { emailRoutes } from "./modules/email/email.routes";
import { emailAdvancedRoutes } from "./modules/email-advanced/email-advanced.routes";
import { calendarRoutes } from "./modules/calendar/calendar.routes";
import { startReportScheduler } from "./modules/reports/reports.scheduler";
import { errorHandler } from "./middlewares/error-handler";
import { notFoundHandler } from "./middlewares/not-found";

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Demasiadas solicitudes, intenta de nuevo mas tarde" },
  skip: (req) => req.path === "/api/notifications/badge",
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Demasiados intentos de inicio de sesion" },
});

const exportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Demasiadas exportaciones, intenta de nuevo mas tarde" },
});

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.corsOrigin,
      credentials: true,
    })
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(cookieParser());
  app.use(pinoHttp({ logger }));
  app.use("/api", globalLimiter);

  app.get("/api/health", async (_req, res) => {
    try {
      const pool = await getPool();
      await pool.request().query("SELECT 1 AS ok");
      res.json({ ok: true, service: "crm-backend", db: true });
    } catch {
      res.status(503).json({ ok: false, service: "crm-backend", db: false });
    }
  });

  app.use("/api/login", authLimiter, authRoutes);

  app.use("/api/cn", requireAuth, catalogRoutes);
  app.use("/api/cn", requireAuth, customersRoutes);
  app.use("/api/cn", requireAuth, activitiesRoutes);
  app.use("/api/cn", requireAuth, opportunitiesRoutes);
  app.use("/api/cn", requireAuth, productsRoutes);
  app.use("/api", requireAuth, notificationsRoutes);
  app.use("/api/dashboard", requireAuth, dashboardRoutes);
  app.use("/api/admin", requireAuth, adminRoutes);
  app.use("/api/reports", exportLimiter, requireAuth, reportsRoutes);
  app.use("/api/profile", requireAuth, profileRoutes);
  app.use("/api/email", requireAuth, emailRoutes);
  app.use("/api/email-advanced", requireAuth, emailAdvancedRoutes);
  app.use("/api/calendar", requireAuth, calendarRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  startReportScheduler();

  return app;
}
