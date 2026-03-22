import { Router } from "express";
import { getRutas, getSucursales } from "./catalog.controller";

const router = Router();

router.post("/sucursal", getSucursales);
router.post("/rutas", getRutas);

export { router as catalogRoutes };
