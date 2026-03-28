import { z } from "zod";

export const productsAbcSchema = z.object({
  PRODUCT_ID: z.coerce.number().optional().default(0),
  SKU: z.string().optional().default(""),
  PRODUCT_NAME: z.string().min(1, "Nombre es requerido"),
  DESCRIPTION: z.string().optional().default(""),
  UNIT_PRICE: z.coerce.number().optional().default(0),
  IS_ACTIVE: z.coerce.boolean().optional().default(true),
  TIPO: z.enum(["A", "C", "B"]),
});

export type ProductsAbcInput = z.infer<typeof productsAbcSchema>;
