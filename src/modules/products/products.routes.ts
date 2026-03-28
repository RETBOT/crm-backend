import { Router } from "express";
import { getProducts, postProductsAbc } from "./products.controller";

const router = Router();

router.get("/productos", getProducts);
router.post("/productos_abc", postProductsAbc);

export { router as productsRoutes };
