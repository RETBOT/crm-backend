import { Request, Response } from "express";
import { abcError, abcSuccess } from "../../shared/legacy-response";
import { PERMISSIONS } from "../auth/permissions";
import { productsAbcSchema, productsListSchema, productCategoriesSchema } from "./products.schemas";
import {
  listProducts,
  productsAbc,
  getProductCategories,
  productCategoriesAbc,
  getProductPriceHistory,
} from "./products.service";

function hasPermission(req: Request, permission: string): boolean {
  return !!req.auth?.permissions?.includes(permission);
}

export async function getProducts(req: Request, res: Response): Promise<void> {
  const input = productsListSchema.parse(req.body ?? {});
  const data = await listProducts(req.auth!.companyId, input);
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

    const msg = await productsAbc(req.auth!.companyId, req.auth!.userId, input);
    res.json(abcSuccess(msg));
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error en operacion de producto";
    res.status(400).json(abcError(msg));
  }
}

export async function getProductCategoriesHandler(req: Request, res: Response): Promise<void> {
  const data = await getProductCategories(req.auth!.companyId);
  res.json(data);
}

export async function postProductCategoriesAbc(req: Request, res: Response): Promise<void> {
  if (!hasPermission(req, PERMISSIONS.PRODUCTS_UPDATE)) {
    res.status(403).json(abcError("No tiene permisos para gestionar categorias"));
    return;
  }
  const input = productCategoriesSchema.parse(req.body ?? {});
  try {
    const msg = await productCategoriesAbc(req.auth!.companyId, input);
    res.json(abcSuccess(msg));
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error en operacion de categoria";
    res.status(400).json(abcError(msg));
  }
}

export async function getProductPriceHistoryHandler(req: Request, res: Response): Promise<void> {
  const productId = Number(req.params.id);
  const data = await getProductPriceHistory(req.auth!.companyId, productId);
  res.json(data);
}
