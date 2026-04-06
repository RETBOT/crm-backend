import { Router } from "express";
import { requireAuth } from "../../middlewares/auth";
import {
  connectEmail,
  sendEmail,
  getEmailHistoryHandler,
  disconnectEmailHandler,
  getConnectedAccounts,
  getOAuthStatus,
} from "./email.controller";

const router = Router();

router.use(requireAuth);

router.post("/connect", connectEmail);
router.post("/send", sendEmail);
router.get("/history", getEmailHistoryHandler);
router.get("/accounts", getConnectedAccounts);
router.get("/oauth-status", getOAuthStatus);
router.delete("/disconnect/:provider", disconnectEmailHandler);

export { router as emailRoutes };
