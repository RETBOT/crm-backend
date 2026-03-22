import { Router } from "express";
import {
  getActivities,
  getActivityTypesHandler,
  postCompleteActivity,
  postCreateActivity,
  postUpdateActivity,
} from "./activities.controller";

const router = Router();

router.post("/actividades", getActivities);
router.post("/actividades_crear", postCreateActivity);
router.post("/actividades_actualizar", postUpdateActivity);
router.post("/actividades_completar", postCompleteActivity);
router.get("/actividades_tipos", getActivityTypesHandler);

export { router as activitiesRoutes };
