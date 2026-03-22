import { Router } from "express";
import { forgotPwd, loginAccess, refreshToken } from "./auth.controller";

const router = Router();

router.post("/access", loginAccess);
router.post("/refresh_token", refreshToken);
router.post("/forgotpwd", forgotPwd);

export { router as authRoutes };
