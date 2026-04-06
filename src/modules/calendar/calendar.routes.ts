import { Router } from "express";
import { requireAuth } from "../../middlewares/auth";
import {
  syncCalendar,
  getCalendarEventsHandler,
  createActivityFromEventHandler,
} from "./calendar.controller";

const router = Router();

router.use(requireAuth);

router.post("/sync", syncCalendar);
router.get("/events", getCalendarEventsHandler);
router.post("/create-activity", createActivityFromEventHandler);

export { router as calendarRoutes };
