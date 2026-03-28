import { z } from "zod";

export const opportunitiesListSchema = z.object({
  CUSTOMER_ID: z.coerce.number().optional().nullable(),
  STATUS: z.string().optional().default(""),
  STAGE_ID: z.coerce.number().optional().nullable(),
  SEARCH: z.string().optional().default(""),
  NPAG: z.coerce.number().optional().default(1),
  TPAG: z.coerce.number().optional().default(20),
});

export const opportunityCreateSchema = z.object({
  CUSTOMER_ID: z.coerce.number(),
  CONTACT_ID: z.coerce.number().optional().nullable(),
  PIPELINE_ID: z.coerce.number().optional().default(1),
  TITLE: z.string().min(1, "Titulo es requerido"),
  DESCRIPTION: z.string().optional().default(""),
  AMOUNT: z.coerce.number().optional().default(0),
  CLOSE_DATE: z.string().optional().nullable(),
  PROBABILITY: z.coerce.number().optional().default(0),
});

export const opportunityUpdateSchema = z.object({
  OPPORTUNITY_ID: z.coerce.number(),
  CUSTOMER_ID: z.coerce.number().optional().nullable(),
  CONTACT_ID: z.coerce.number().optional().nullable(),
  TITLE: z.string().min(1, "Titulo es requerido"),
  DESCRIPTION: z.string().optional().default(""),
  AMOUNT: z.coerce.number().optional().default(0),
  CLOSE_DATE: z.string().optional().nullable(),
  PROBABILITY: z.coerce.number().optional().default(0),
});

export const opportunityAdvanceSchema = z.object({
  OPPORTUNITY_ID: z.coerce.number(),
  STAGE_ID: z.coerce.number(),
});

export const opportunityStatusSchema = z.object({
  OPPORTUNITY_ID: z.coerce.number(),
  STATUS: z.enum(["ganada", "perdida"]),
  LOST_REASON: z.string().optional().default(""),
});

export const opportunityReopenSchema = z.object({
  OPPORTUNITY_ID: z.coerce.number(),
});

export const opportunityItemSchema = z.object({
  ITEM_ID: z.coerce.number().optional().default(0),
  PRODUCT_ID: z.coerce.number().optional().nullable(),
  ITEM_DESCRIPTION: z.string().optional().default(""),
  QUANTITY: z.coerce.number().optional().default(1),
  UNIT_PRICE: z.coerce.number().optional().default(0),
  DISCOUNT_PCT: z.coerce.number().optional().default(0),
});

export type OpportunitiesListInput = z.infer<typeof opportunitiesListSchema>;
export type OpportunityCreateInput = z.infer<typeof opportunityCreateSchema>;
export type OpportunityUpdateInput = z.infer<typeof opportunityUpdateSchema>;
export type OpportunityAdvanceInput = z.infer<typeof opportunityAdvanceSchema>;
export type OpportunityStatusInput = z.infer<typeof opportunityStatusSchema>;
export type OpportunityReopenInput = z.infer<typeof opportunityReopenSchema>;
export type OpportunityItemInput = z.infer<typeof opportunityItemSchema>;
