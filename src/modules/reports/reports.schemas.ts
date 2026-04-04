import { z } from "zod";

// Filtros base para todos los reportes
export const reportFilterSchema = z.object({
  START_DATE: z.string().optional().nullable(),
  END_DATE: z.string().optional().nullable(),
  BRANCH_IDS: z.array(z.number()).optional().nullable(),
  USER_IDS: z.array(z.number()).optional().nullable(),
  PRODUCT_IDS: z.array(z.number()).optional().nullable(),
  STATUS: z.string().optional().nullable(),
  STAGE_IDS: z.array(z.number()).optional().nullable(),
  MIN_AMOUNT: z.number().optional().nullable(),
  MAX_AMOUNT: z.number().optional().nullable(),
  SEARCH: z.string().optional().default(""),
  // Para comparativas
  COMPARE_START_DATE: z.string().optional().nullable(),
  COMPARE_END_DATE: z.string().optional().nullable(),
  // Para drill-down
  DRILLDOWN_BY: z.string().optional().nullable(),
  DRILLDOWN_VALUE: z.string().optional().nullable(),
});

// Tipos de reportes
export const reportTypeSchema = z.enum([
  "dashboard",
  "sales",
  "customers",
  "activities",
  "opportunities",
  "products",
]);

// Exportación
export const exportReportSchema = z.object({
  REPORT_TYPE: reportTypeSchema,
  FORMAT: z.enum(["excel", "pdf"]).default("excel"),
  FILTERS: reportFilterSchema.optional(),
  FILENAME: z.string().optional(),
});

// Vistas guardadas
export const savedViewSchema = z.object({
  VIEW_NAME: z.string().min(1).max(100),
  REPORT_TYPE: reportTypeSchema,
  FILTERS: z.union([reportFilterSchema, z.string()]).optional(),
  IS_DEFAULT: z.boolean().optional().default(false),
});

export const savedViewUpdateSchema = z.object({
  VIEW_NAME: z.string().min(1).max(100).optional(),
  FILTERS: z.union([reportFilterSchema, z.string()]).optional(),
  IS_DEFAULT: z.boolean().optional(),
});

// Reportes programados
export const scheduledReportSchema = z.object({
  REPORT_TYPE: reportTypeSchema,
  FREQUENCY: z.enum(["daily", "weekly", "monthly"]),
  DAY_OF_WEEK: z.number().min(0).max(6).optional().nullable(), // 0=Sunday, 6=Saturday
  DAY_OF_MONTH: z.number().min(1).max(31).optional().nullable(),
  RECIPIENTS: z.array(z.string().email()),
  FILTERS: reportFilterSchema,
  IS_ACTIVE: z.boolean().optional().default(true),
});

export const scheduledReportUpdateSchema = z.object({
  FREQUENCY: z.enum(["daily", "weekly", "monthly"]).optional(),
  DAY_OF_WEEK: z.number().min(0).max(6).optional().nullable(),
  DAY_OF_MONTH: z.number().min(1).max(31).optional().nullable(),
  RECIPIENTS: z.array(z.string().email()).optional(),
  FILTERS: reportFilterSchema.optional(),
  IS_ACTIVE: z.boolean().optional(),
});

// Tipos inferidos
export type ReportFilterInput = z.infer<typeof reportFilterSchema>;
export type ReportType = z.infer<typeof reportTypeSchema>;
export type ExportReportInput = z.infer<typeof exportReportSchema>;
export type SavedViewInput = z.infer<typeof savedViewSchema>;
export type SavedViewUpdateInput = z.infer<typeof savedViewUpdateSchema>;
export type ScheduledReportInput = z.infer<typeof scheduledReportSchema>;
export type ScheduledReportUpdateInput = z.infer<typeof scheduledReportUpdateSchema>;