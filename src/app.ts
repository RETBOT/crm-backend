import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
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
import { errorHandler } from "./middlewares/error-handler";
import { notFoundHandler } from "./middlewares/not-found";

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

  app.get("/api/health", async (_req, res) => {
    try {
      const pool = await getPool();
      await pool.request().query("SELECT 1 AS ok");
      res.json({ ok: true, service: "crm-backend", db: true });
    } catch {
      res.status(503).json({ ok: false, service: "crm-backend", db: false });
    }
  });

  app.use("/api/login", authRoutes);

  app.use("/api/cn", requireAuth, catalogRoutes);
  app.use("/api/cn", requireAuth, customersRoutes);
  app.use("/api/dashboard", requireAuth, dashboardRoutes);
  app.use("/api/admin", requireAuth, adminRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
