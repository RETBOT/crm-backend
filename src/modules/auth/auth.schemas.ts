import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres")
  .max(100)
  .regex(/[A-Z]/, "Debe contener al menos una letra mayuscula")
  .regex(/[a-z]/, "Debe contener al menos una letra minuscula")
  .regex(/[0-9]/, "Debe contener al menos un numero");

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const refreshSchema = z.object({
  username: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
  username: z.string().min(1),
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: passwordSchema,
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
