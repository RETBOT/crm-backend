import { Request, Response } from "express";
import { forgotPasswordSchema, loginSchema } from "./auth.schemas";
import { buildLoginPayload, forgotPassword, validateUser } from "./auth.service";
import { loginError, loginSuccess } from "../../shared/legacy-response";

export async function loginAccess(req: Request, res: Response): Promise<void> {
  const parsed = loginSchema.parse(req.body);

  try {
    const user = await validateUser(parsed.username, parsed.password);
    res.json(loginSuccess(buildLoginPayload(user)));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Usuario o contraseña incorrectos";
    res.status(401).json(loginError(message));
  }
}

export async function refreshToken(req: Request, res: Response): Promise<void> {
  const parsed = loginSchema.parse(req.body);

  try {
    const user = await validateUser(parsed.username, parsed.password);
    const payload = buildLoginPayload(user);
    res.json(payload.token);
  } catch {
    res.status(401).json({ message: "No se pudo renovar el token" });
  }
}

export async function forgotPwd(req: Request, res: Response): Promise<void> {
  const parsed = forgotPasswordSchema.parse(req.body);
  const result = await forgotPassword(parsed.username, parsed.email);
  res.json(result);
}
