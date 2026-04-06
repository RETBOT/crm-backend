import { Request, Response, NextFunction } from "express";
import { syncCalendarSchema, calendarEventsQuerySchema, createActivityFromEventSchema } from "./calendar.schemas";
import {
  syncGoogleCalendar,
  syncMicrosoftCalendar,
  getCalendarEvents,
  createActivityFromEvent,
} from "./calendar.service";
import { HttpError } from "../../shared/http-error";

function getUserId(req: Request): number {
  return Number((req as any).auth?.userId);
}

function getCompanyId(req: Request): number {
  return Number((req as any).auth?.companyId);
}

export async function syncCalendar(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);
    const { provider } = syncCalendarSchema.parse(req.body);

    let result: { count: number };

    if (provider === "google") {
      result = await syncGoogleCalendar(userId);
    } else {
      result = await syncMicrosoftCalendar(userId);
    }

    res.json({
      message: `Calendario de ${provider === "google" ? "Google" : "Outlook"} sincronizado`,
      eventsSynced: result.count,
      provider,
    });
  } catch (error) {
    next(error);
  }
}

export async function getCalendarEventsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);
    const companyId = getCompanyId(req);
    const { from, to } = calendarEventsQuerySchema.parse(req.query);

    const events = await getCalendarEvents(userId, companyId, { from, to });

    res.json(events);
  } catch (error) {
    next(error);
  }
}

export async function createActivityFromEventHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);
    const { eventId, activityType } = createActivityFromEventSchema.parse(req.body);

    await createActivityFromEvent(userId, eventId, activityType);

    res.json({ message: "Actividad creada desde el evento" });
  } catch (error) {
    next(error);
  }
}
