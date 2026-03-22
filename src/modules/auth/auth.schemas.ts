import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
  username: z.string().min(1),
  email: z.string().email(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
