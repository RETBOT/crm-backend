import { Router } from "express";
import { getPuestos, getRutas, getSucursales } from "./catalog.controller";

const router = Router();

router.post("/sucursal", getSucursales);
router.post("/rutas", getRutas);
router.post("/puestos", getPuestos);

export { router as catalogRoutes };
