import { z } from "zod";

export const syncCalendarSchema = z.object({
  provider: z.enum(["google", "microsoft"]),
});

export const calendarEventsQuerySchema = z.object({
  from: z.coerce.string().optional(),
  to: z.coerce.string().optional(),
});

export const createActivityFromEventSchema = z.object({
  eventId: z.coerce.number().int().positive(),
  activityType: z.string().min(1).optional(),
});
