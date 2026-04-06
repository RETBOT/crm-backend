import { z } from "zod";

export const templateSchema = z.object({
  name: z.string().min(1).max(255),
  subject: z.string().min(1).max(500),
  body: z.string().min(1),
  variables: z.string().optional().nullable(),
});

export const sendWithTemplateSchema = z.object({
  to: z.string().min(1).email(),
  cc: z.string().optional().nullable(),
  bcc: z.string().optional().nullable(),
  templateId: z.coerce.number().int().positive(),
  variables: z.record(z.string()).optional(),
  customerId: z.coerce.number().int().positive().optional().nullable(),
});

export const signatureSchema = z.object({
  signatureHtml: z.string().min(1),
  isDefault: z.boolean().optional(),
});

export const trackOpenSchema = z.object({
  emailId: z.coerce.number().int().positive(),
});

export const trackClickSchema = z.object({
  emailId: z.coerce.number().int().positive(),
  link: z.string().url(),
});
