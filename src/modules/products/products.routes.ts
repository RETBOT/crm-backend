import { Router } from "express";
import {
  getProducts,
  postProductsAbc,
  getProductCategoriesHandler,
  postProductCategoriesAbc,
  getProductPriceHistoryHandler,
} from "./products.controller";

const router = Router();

router.post("/productos", getProducts);
router.post("/productos_abc", postProductsAbc);
router.get("/productos_categorias", getProductCategoriesHandler);
router.post("/productos_categorias_abc", postProductCategoriesAbc);
router.get("/productos/:id/precio_historial", getProductPriceHistoryHandler);

export { router as productsRoutes };
