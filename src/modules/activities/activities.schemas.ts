import { z } from "zod";

export const activitiesListSchema = z.object({
  CUSTOMER_ID: z.coerce.number().optional().nullable(),
  STATUS: z.string().optional().default(""),
  TYPE: z.string().optional().default(""),
  SEARCH: z.string().optional().default(""),
  NPAG: z.coerce.number().optional().default(1),
  TPAG: z.coerce.number().optional().default(20),
});

export const activityCreateSchema = z
  .object({
    CUSTOMER_ID: z.coerce.number(),
    CONTACT_ID: z.coerce.number().optional().nullable(),
    OPPORTUNITY_ID: z.coerce.number().optional().nullable(),
    TYPE: z.string().min(1, "Tipo es requerido"),
    SUBJECT: z.string().min(1, "Asunto es requerido"),
    NOTES: z.string().optional().default(""),
    DUE_AT: z.string().optional().nullable(),
    PRIORITY: z.string().min(1, "Prioridad es requerida"),
  });

export const activityUpdateSchema = z
  .object({
    ACTIVITY_ID: z.coerce.number(),
    CUSTOMER_ID: z.coerce.number().optional().nullable(),
    CONTACT_ID: z.coerce.number().optional().nullable(),
    OPPORTUNITY_ID: z.coerce.number().optional().nullable(),
    TYPE: z.string().min(1, "Tipo es requerido"),
    SUBJECT: z.string().min(1, "Asunto es requerido"),
    NOTES: z.string().optional().default(""),
    DUE_AT: z.string().optional().nullable(),
    PRIORITY: z.string().min(1, "Prioridad es requerida"),
  });

export const activityCompleteSchema = z.object({
  ACTIVITY_ID: z.coerce.number(),
  STATUS: z.enum(["Completada", "Cancelada"]),
});

export type ActivitiesListInput = z.infer<typeof activitiesListSchema>;
export type ActivityCreateInput = z.infer<typeof activityCreateSchema>;
export type ActivityUpdateInput = z.infer<typeof activityUpdateSchema>;
export type ActivityCompleteInput = z.infer<typeof activityCompleteSchema>;
