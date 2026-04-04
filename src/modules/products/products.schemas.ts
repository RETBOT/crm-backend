import { z } from "zod";

export const productsAbcSchema = z.object({
  PRODUCT_ID: z.coerce.number().optional().default(0),
  SKU: z.string().min(1, "SKU es requerido"),
  PRODUCT_NAME: z.string().min(1, "Nombre es requerido"),
  DESCRIPTION: z.string().optional().default(""),
  UNIT_PRICE: z.coerce.number().min(0, "El precio no puede ser negativo").optional().default(0),
  CATEGORY_ID: z.coerce.number().optional().nullable(),
  IS_ACTIVE: z.coerce.boolean().optional().default(true),
  TIPO: z.enum(["A", "C", "B"]),
});

export const productsListSchema = z.object({
  SEARCH: z.string().optional().default(""),
  STATUS: z.string().optional().default(""),
  CATEGORY_ID: z.coerce.number().optional().nullable(),
  SORT_BY: z.string().optional().default("product_name"),
  SORT_DIR: z.enum(["ASC", "DESC"]).optional().default("ASC"),
  NPAG: z.coerce.number().optional().default(1),
  TPAG: z.coerce.number().optional().default(20),
});

export const productCategoriesSchema = z.object({
  CATEGORY_ID: z.coerce.number().optional().default(0),
  CATEGORY_NAME: z.string().min(1, "Nombre es requerido"),
  DESCRIPTION: z.string().optional().default(""),
  IS_ACTIVE: z.coerce.boolean().optional().default(true),
  TIPO: z.enum(["A", "C", "B"]),
});

export type ProductsAbcInput = z.infer<typeof productsAbcSchema>;
export type ProductsListInput = z.infer<typeof productsListSchema>;
export type ProductCategoriesInput = z.infer<typeof productCategoriesSchema>;
