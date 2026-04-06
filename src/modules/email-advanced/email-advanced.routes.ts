import { Router } from "express";
import { requireAuth } from "../../middlewares/auth";
import {
  listTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  sendWithTemplate,
  handleTrackOpen,
  handleTrackClick,
  getSignature,
  saveSignature,
  getTrackingStats,
} from "./email-advanced.controller";

const router = Router();

router.use(requireAuth);

router.get("/templates", listTemplates);
router.post("/templates", createTemplate);
router.put("/templates/:id", updateTemplate);
router.delete("/templates/:id", deleteTemplate);
router.post("/send-with-template", sendWithTemplate);
router.get("/track/open/:emailId", handleTrackOpen);
router.post("/track/click", handleTrackClick);
router.get("/signature", getSignature);
router.put("/signature", saveSignature);
router.get("/tracking-stats", getTrackingStats);

export { router as emailAdvancedRoutes };
