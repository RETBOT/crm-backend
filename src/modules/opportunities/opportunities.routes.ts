import { Router } from "express";
import {
  getOpportunities,
  getOpportunitiesByCustomerHandler,
  getOpportunityItemsHandler,
  getPipelinesHandler,
  postAdvanceStage,
  postCreateOpportunity,
  postCreateOpportunityItem,
  postDeleteOpportunityItem,
  deleteOpportunityHandler,
  postReopen,
  postSetStatus,
  postUpdateOpportunity,
  postUpdateOpportunityItem,
} from "./opportunities.controller";

const router = Router();

router.post("/oportunidades", getOpportunities);
router.post("/oportunidades_crear", postCreateOpportunity);
router.post("/oportunidades_actualizar", postUpdateOpportunity);
router.post("/oportunidades_eliminar", deleteOpportunityHandler);
router.post("/oportunidades_avanzar", postAdvanceStage);
router.post("/oportunidades_status", postSetStatus);
router.post("/oportunidades_reabrir", postReopen);
router.get("/oportunidades/:id/items", getOpportunityItemsHandler);
router.post("/oportunidades/:id/items", postCreateOpportunityItem);
router.put("/oportunidades/:opportunityId/items/:itemId", postUpdateOpportunityItem);
router.delete("/oportunidades/:opportunityId/items/:itemId", postDeleteOpportunityItem);
router.get("/oportunidades_by_customer/:customerId", getOpportunitiesByCustomerHandler);
router.get("/pipelines", getPipelinesHandler);

export { router as opportunitiesRoutes };
