import { Request, Response } from "express";
import { abcError, abcSuccess } from "../../shared/legacy-response";
import { PERMISSIONS } from "../auth/permissions";
import {
  activitiesListSchema,
  activityCompleteSchema,
  activityCreateSchema,
  activityUpdateSchema,
} from "./activities.schemas";
import {
  completeActivity,
  createActivity,
  getActivityTypes,
  getUsersForAssignment,
  listActivities,
  updateActivity,
} from "./activities.service";

function hasPermission(req: Request, permission: string): boolean {
  return !!req.auth?.permissions?.includes(permission);
}

export async function getActivities(req: Request, res: Response): Promise<void> {
  const input = activitiesListSchema.parse(req.body ?? {});
  const data = await listActivities(req.auth!.companyId, req.auth!.userId, input);
  res.json(data);
}

export async function postCreateActivity(req: Request, res: Response): Promise<void> {
  const input = activityCreateSchema.parse(req.body ?? {});

  try {
    if (!hasPermission(req, PERMISSIONS.ACTIVITIES_CREATE)) {
      res.status(403).json(abcError("No cuenta con permisos para crear actividades"));
      return;
    }

    const canAssign = hasPermission(req, PERMISSIONS.ACTIVITIES_ASSIGN);
    const msg = await createActivity(req.auth!.companyId, req.auth!.userId, input, canAssign);
    res.json(abcSuccess(msg));
  } catch (error) {
    const msg = error instanceof Error ? error.message : "No se pudo crear la actividad";
    res.status(400).json(abcError(msg));
  }
}

export async function postUpdateActivity(req: Request, res: Response): Promise<void> {
  const input = activityUpdateSchema.parse(req.body ?? {});

  try {
    if (!hasPermission(req, PERMISSIONS.ACTIVITIES_UPDATE)) {
      res.status(403).json(abcError("No cuenta con permisos para actualizar actividades"));
      return;
    }

    const msg = await updateActivity(req.auth!.companyId, req.auth!.userId, input);
    res.json(abcSuccess(msg));
  } catch (error) {
    const msg = error instanceof Error ? error.message : "No se pudo actualizar la actividad";
    res.status(400).json(abcError(msg));
  }
}

export async function postCompleteActivity(req: Request, res: Response): Promise<void> {
  const input = activityCompleteSchema.parse(req.body ?? {});

  try {
    if (!hasPermission(req, PERMISSIONS.ACTIVITIES_COMPLETE)) {
      res.status(403).json(abcError("No cuenta con permisos para completar actividades"));
      return;
    }

    const msg = await completeActivity(req.auth!.companyId, req.auth!.userId, input);
    res.json(abcSuccess(msg));
  } catch (error) {
    const msg = error instanceof Error ? error.message : "No se pudo completar la actividad";
    res.status(400).json(abcError(msg));
  }
}

export async function getActivityTypesHandler(_req: Request, res: Response): Promise<void> {
  const data = await getActivityTypes();
  res.json(data);
}

export async function getActivityUsersHandler(req: Request, res: Response): Promise<void> {
  try {
    const data = await getUsersForAssignment(req.auth!.companyId, req.auth!.userId);
    res.json(data);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "No se pudieron obtener los usuarios";
    res.status(400).json(abcError(msg));
  }
}
