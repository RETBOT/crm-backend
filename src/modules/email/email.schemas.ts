import { z } from "zod";

export const connectEmailSchema = z.object({
  provider: z.enum(["google", "microsoft"]),
  code: z.string().min(1),
  redirectUri: z.string().url(),
});

export const sendEmailSchema = z.object({
  to: z.string().min(1).email(),
  cc: z.string().optional().nullable(),
  bcc: z.string().optional().nullable(),
  subject: z.string().min(1).max(500),
  body: z.string().min(1),
  customerId: z.number().int().positive().optional().nullable(),
});

export const emailHistoryQuerySchema = z.object({
  customerId: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});
