import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { logger } from "../config/logger";
import { HttpError } from "../shared/http-error";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      message: "Datos inválidos",
      errors: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
    return;
  }

  if (err instanceof HttpError) {
    res.status(err.statusCode).json({ message: err.message });
    return;
  }

  logger.error({ err }, "Unhandled error");
  res.status(500).json({ message: "Error interno del servidor" });
}
