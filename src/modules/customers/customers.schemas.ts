import { z } from "zod";

export const customersSchema = z.object({
  CLIENTEID: z.union([z.string(), z.number()]).optional().transform((v) => String(v ?? "")),
  NOMBRECLI: z.string().optional().default(""),
  SUCURSAL: z.union([z.string(), z.number()]).optional().transform((v) => String(v ?? "")),
  ESTATUS: z.string().optional().default(""),
  RUTA: z.union([z.string(), z.number()]).optional().transform((v) => String(v ?? "")),
  NPAG: z.coerce.number().optional().default(1),
  TPAG: z.coerce.number().optional().default(20),
  TIPO: z.string().optional().default("CLIENTE"),
});

export const contactsSchema = z.object({
  CLIENTEID: z.union([z.string(), z.number()]).optional().nullable().transform((v) => v != null ? String(v) : ""),
});

export const contactsAbcSchema = z.object({
  CLIENTEID: z.union([z.string(), z.number()]).transform((v) => String(v)),
  CONTACTOID: z.coerce.number().optional().default(0),
  NOMBRE: z.string().optional().default(""),
  APATERNO: z.string().optional().default(""),
  AMATERNO: z.string().optional().default(""),
  TELEFONO: z.string().optional().default(""),
  EXTENSION: z.string().optional().default(""),
  PUESTOID: z.string().optional().default(""),
  COMENTARIOS: z.string().optional().default(""),
  WHATSAPP: z.string().optional().default(""),
  EMAIL: z.string().optional().default(""),
  TIPO: z.enum(["A", "C", "B"]),
});

export const customersAbcSchema = z
  .object({
  CLIENTEID: z.union([z.string(), z.number()]).optional().transform((v) => String(v ?? "")),
  NOMBRECLI: z.string().optional().default(""),
  GIRO: z.string().optional().default(""),
  CALLE: z.string().optional().default(""),
  NUM_EXT: z.string().optional().default(""),
  COLONIA: z.string().optional().default(""),
  CIUDAD: z.string().optional().default(""),
  ESTADO: z.string().optional().default(""),
  EMAIL: z.string().optional().default(""),
  TEL: z.string().optional().default(""),
  ESTATUS: z.string().optional().default("ACTIVO"),
  SUCURSAL: z.coerce.number().optional().nullable(),
  RUTA: z.coerce.number().optional().nullable(),
  LAT: z.coerce.number().optional().nullable(),
  LON: z.coerce.number().optional().nullable(),
  TIPO_CLIENTE: z.enum(["CLIENTE", "PROSPECTO"]).optional().default("CLIENTE"),
  TIPO: z.enum(["A", "C", "B"]),
  })
  .superRefine((data, ctx) => {
    if ((data.TIPO === "A" || data.TIPO === "C") && !data.NOMBRECLI.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "NOMBRECLI es requerido",
        path: ["NOMBRECLI"],
      });
    }

    if ((data.TIPO === "C" || data.TIPO === "B") && !data.CLIENTEID.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "CLIENTEID es requerido",
        path: ["CLIENTEID"],
      });
    }

    if (data.LAT !== null && data.LAT !== undefined && (data.LAT < -90 || data.LAT > 90)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "LAT debe estar entre -90 y 90",
        path: ["LAT"],
      });
    }

    if (data.LON !== null && data.LON !== undefined && (data.LON < -180 || data.LON > 180)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "LON debe estar entre -180 y 180",
        path: ["LON"],
      });
    }
  });

export const convertProspectSchema = z.object({
  CLIENTEID: z.union([z.string(), z.number()]).transform((v) => String(v)),
});

export type CustomersInput = z.infer<typeof customersSchema>;
export type ContactsInput = z.infer<typeof contactsSchema>;
export type ContactsAbcInput = z.infer<typeof contactsAbcSchema>;
export type CustomersAbcInput = z.infer<typeof customersAbcSchema>;
export type ConvertProspectInput = z.infer<typeof convertProspectSchema>;
