import { Router } from "express";
import { getProfile, updateProfile, changePassword } from "./profile.controller";

const router = Router();

router.get("/me", getProfile);
router.put("/me", updateProfile);
router.put("/me/password", changePassword);

export { router as profileRoutes };
