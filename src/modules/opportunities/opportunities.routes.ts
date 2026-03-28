import { Router } from "express";
import {
  getOpportunities,
  getOpportunitiesByCustomerHandler,
  getOpportunityItemsHandler,
  getPipelinesHandler,
  postAdvanceStage,
  postCreateOpportunity,
  postReopen,
  postSetStatus,
  postUpdateOpportunity,
} from "./opportunities.controller";

const router = Router();

router.post("/oportunidades", getOpportunities);
router.post("/oportunidades_crear", postCreateOpportunity);
router.post("/oportunidades_actualizar", postUpdateOpportunity);
router.post("/oportunidades_avanzar", postAdvanceStage);
router.post("/oportunidades_status", postSetStatus);
router.post("/oportunidades_reabrir", postReopen);
router.get("/oportunidades/:id/items", getOpportunityItemsHandler);
router.get("/oportunidades_by_customer/:customerId", getOpportunitiesByCustomerHandler);
router.get("/pipelines", getPipelinesHandler);

export { router as opportunitiesRoutes };
