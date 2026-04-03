import { Router } from "express";
import { forgotPwd, loginAccess, refreshToken, resetPassword } from "./auth.controller";

const router = Router();

router.post("/access", loginAccess);
router.post("/refresh_token", refreshToken);
router.post("/forgotpwd", forgotPwd);
router.post("/reset-password", resetPassword);

export { router as authRoutes };
