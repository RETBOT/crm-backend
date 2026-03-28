import { Request, Response } from "express";
import { abcError, abcSuccess } from "../../shared/legacy-response";
import { productsAbcSchema } from "./products.schemas";
import { listProducts, productsAbc } from "./products.service";

export async function getProducts(req: Request, res: Response): Promise<void> {
  const data = await listProducts(req.auth!.companyId);
  res.json(data);
}

export async function postProductsAbc(req: Request, res: Response): Promise<void> {
  const input = productsAbcSchema.parse(req.body ?? {});
  try {
    const msg = await productsAbc(req.auth!.companyId, input);
    res.json(abcSuccess(msg));
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error en operacion de producto";
    res.status(400).json(abcError(msg));
  }
}
