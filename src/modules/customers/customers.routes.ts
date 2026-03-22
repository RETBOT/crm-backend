import { Router } from "express";
import {
  getContacts,
  getCustomers,
  postContactsAbc,
  postConvertProspect,
  postCustomersAbc,
} from "./customers.controller";

const router = Router();

router.post("/clientes", getCustomers);
router.post("/contactos", getContacts);
router.post("/contactos_abc", postContactsAbc);
router.post("/clientes_abc", postCustomersAbc);
router.post("/prospecto_convertir", postConvertProspect);

export { router as customersRoutes };
