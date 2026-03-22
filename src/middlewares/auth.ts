import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";

type AuthJwtPayload = {
  sub: number;
  company_id: number;
  username: string;
  permissions?: string[];
};

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ message: "Token no proporcionado" });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(token, env.jwtSecret);
    if (typeof decoded === "string") {
      res.status(401).json({ message: "Token inválido o expirado" });
      return;
    }

    const typed = decoded as unknown as AuthJwtPayload;
    req.auth = {
      userId: Number(typed.sub),
      companyId: typed.company_id,
      username: typed.username,
      permissions: Array.isArray(typed.permissions) ? typed.permissions : [],
    };
    next();
  } catch {
    res.status(401).json({ message: "Token inválido o expirado" });
  }
}
