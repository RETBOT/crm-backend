import { Router } from "express";
import {
  getNotifications,
  getNotificationsBadge,
  putNotificationRead,
  putNotificationsReadAll,
} from "./notifications.controller";

const router = Router();

router.get("/notifications", getNotifications);
router.get("/notifications/badge", getNotificationsBadge);
router.put("/notifications/:id/read", putNotificationRead);
router.put("/notifications/read-all", putNotificationsReadAll);

export { router as notificationsRoutes };
