import { Request, Response } from "express";
import { z } from "zod";
import { getMyProfile, updateMyProfile, changeMyPassword } from "./profile.service";

const updateProfileSchema = z.object({
  display_name: z.string().min(3).max(140).optional(),
  email: z.string().email().optional().or(z.literal("")).optional(),
});

const changePasswordSchema = z.object({
  current_password: z.string().min(1, "La contrasena actual es requerida"),
  new_password: z.string().min(6, "Minimo 6 caracteres").max(100),
});

export async function getProfile(req: Request, res: Response): Promise<void> {
  const data = await getMyProfile(req.auth!.userId);
  res.json(data);
}

export async function updateProfile(req: Request, res: Response): Promise<void> {
  const parsed = updateProfileSchema.parse(req.body ?? {});
  await updateMyProfile(req.auth!.userId, parsed);
  res.json({ ok: true, message: "Perfil actualizado correctamente" });
}

export async function changePassword(req: Request, res: Response): Promise<void> {
  const parsed = changePasswordSchema.parse(req.body ?? {});
  await changeMyPassword(req.auth!.userId, parsed.current_password, parsed.new_password);
  res.json({ ok: true, message: "Contrasena actualizada correctamente" });
}
