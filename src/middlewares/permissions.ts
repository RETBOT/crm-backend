import { NextFunction, Request, Response } from "express";

export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const permissions = req.auth?.permissions ?? [];
    if (!permissions.includes(permission)) {
      res.status(403).json({ message: "No cuenta con permisos para esta acción" });
      return;
    }
    next();
  };
}

export function requireAnyPermission(permissionList: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const permissions = req.auth?.permissions ?? [];
    const allowed = permissionList.some((p) => permissions.includes(p));
    if (!allowed) {
      res.status(403).json({ message: "No cuenta con permisos para esta acción" });
      return;
    }
    next();
  };
}
