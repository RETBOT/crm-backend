import { Router } from "express";
import { getPuestos, getVendedores, getSucursales } from "./catalog.controller";

const router = Router();

router.post("/sucursal", getSucursales);
router.post("/vendedores", getVendedores);
router.post("/puestos", getPuestos);

export { router as catalogRoutes };
