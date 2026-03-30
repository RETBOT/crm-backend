import { Request, Response } from "express";
import { abcError, abcSuccess } from "../../shared/legacy-response";
import { PERMISSIONS } from "../auth/permissions";
import { productsAbcSchema } from "./products.schemas";
import { listProducts, productsAbc } from "./products.service";

function hasPermission(req: Request, permission: string): boolean {
  return !!req.auth?.permissions?.includes(permission);
}

export async function getProducts(req: Request, res: Response): Promise<void> {
  const data = await listProducts(req.auth!.companyId);
  res.json(data);
}

export async function postProductsAbc(req: Request, res: Response): Promise<void> {
  const input = productsAbcSchema.parse(req.body ?? {});
  try {
    if (input.TIPO === "A" && !hasPermission(req, PERMISSIONS.PRODUCTS_CREATE)) {
      res.status(403).json(abcError("No tiene permisos para crear productos"));
      return;
    }
    if (input.TIPO === "C") {
      if (!hasPermission(req, PERMISSIONS.PRODUCTS_UPDATE)) {
        res.status(403).json(abcError("No tiene permisos para actualizar productos"));
        return;
      }
      if (input.UNIT_PRICE > 0 && !hasPermission(req, PERMISSIONS.PRODUCTS_PRICE_EDIT)) {
        res.status(403).json(abcError("No tiene permisos para editar precios de productos"));
        return;
      }
    }
    if (input.TIPO === "B" && !hasPermission(req, PERMISSIONS.PRODUCTS_DELETE)) {
      res.status(403).json(abcError("No tiene permisos para eliminar productos"));
      return;
    }

    const msg = await productsAbc(req.auth!.companyId, input);
    res.json(abcSuccess(msg));
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error en operacion de producto";
    res.status(400).json(abcError(msg));
  }
}
