import { Request, Response } from "express";
import { abcError, abcSuccess } from "../../shared/legacy-response";
import { PERMISSIONS } from "../auth/permissions";
import {
  opportunitiesListSchema,
  opportunityAdvanceSchema,
  opportunityCreateSchema,
  opportunityItemSchema,
  opportunityStatusSchema,
  opportunityUpdateSchema,
} from "./opportunities.schemas";
import {
  advanceOpportunityStage,
  createOpportunity,
  createOpportunityItem,
  deleteOpportunityItem,
  getOpportunitiesByCustomer,
  getOpportunityItems,
  getPipelines,
  listOpportunities,
  reopenOpportunity,
  setOpportunityStatus,
  updateOpportunity,
  updateOpportunityItem,
} from "./opportunities.service";

function hasPermission(req: Request, permission: string): boolean {
  return !!req.auth?.permissions?.includes(permission);
}

export async function getOpportunities(req: Request, res: Response): Promise<void> {
  const input = opportunitiesListSchema.parse(req.body ?? {});
  const data = await listOpportunities(req.auth!.companyId, req.auth!.userId, input);
  res.json(data);
}

export async function getOpportunityItemsHandler(req: Request, res: Response): Promise<void> {
  const oppId = Number(req.params.id);
  const data = await getOpportunityItems(req.auth!.companyId, oppId);
  res.json(data);
}

export async function getOpportunitiesByCustomerHandler(req: Request, res: Response): Promise<void> {
  const customerId = Number(req.params.customerId);
  const data = await getOpportunitiesByCustomer(req.auth!.companyId, req.auth!.userId, customerId);
  res.json(data);
}

export async function postCreateOpportunity(req: Request, res: Response): Promise<void> {
  if (!hasPermission(req, PERMISSIONS.OPPORTUNITIES_CREATE)) {
    res.status(403).json(abcError("No tiene permisos para crear oportunidades"));
    return;
  }

  const body = req.body ?? {};
  const input = opportunityCreateSchema.parse(body);
  const items = Array.isArray(body.ITEMS) ? body.ITEMS.map((i: any) => opportunityItemSchema.parse(i)) : [];
  const id = await createOpportunity(req.auth!.companyId, req.auth!.userId, input, items);
  res.json({ resultado: 1, msg: "Oportunidad creada correctamente", opportunity_id: id });
}

export async function postUpdateOpportunity(req: Request, res: Response): Promise<void> {
  if (!hasPermission(req, PERMISSIONS.OPPORTUNITIES_UPDATE)) {
    res.status(403).json(abcError("No tiene permisos para actualizar oportunidades"));
    return;
  }

  const body = req.body ?? {};
  const input = opportunityUpdateSchema.parse(body);
  const items = Array.isArray(body.ITEMS) ? body.ITEMS.map((i: any) => opportunityItemSchema.parse(i)) : [];
  await updateOpportunity(req.auth!.companyId, req.auth!.userId, input, items);
  res.json(abcSuccess("Oportunidad actualizada correctamente"));
}

export async function postAdvanceStage(req: Request, res: Response): Promise<void> {
  if (!hasPermission(req, PERMISSIONS.OPPORTUNITIES_UPDATE)) {
    res.status(403).json(abcError("No tiene permisos para cambiar etapas"));
    return;
  }

  const input = opportunityAdvanceSchema.parse(req.body ?? {});
  await advanceOpportunityStage(req.auth!.companyId, req.auth!.userId, input);
  res.json(abcSuccess("Etapa avanzada correctamente"));
}

export async function postSetStatus(req: Request, res: Response): Promise<void> {
  if (!hasPermission(req, PERMISSIONS.OPPORTUNITIES_UPDATE)) {
    res.status(403).json(abcError("No tiene permisos para cambiar status"));
    return;
  }

  const input = opportunityStatusSchema.parse(req.body ?? {});
  await setOpportunityStatus(req.auth!.companyId, req.auth!.userId, input);
  const msg = input.STATUS === "ganada" ? "Oportunidad marcada como ganada" : "Oportunidad marcada como perdida";
  res.json(abcSuccess(msg));
}

export async function postReopen(req: Request, res: Response): Promise<void> {
  if (!hasPermission(req, PERMISSIONS.OPPORTUNITIES_UPDATE)) {
    res.status(403).json(abcError("No tiene permisos para reabrir oportunidades"));
    return;
  }

  await reopenOpportunity(req.auth!.companyId, req.auth!.userId, req.body ?? {});
  res.json(abcSuccess("Oportunidad reabierta correctamente"));
}

export async function getPipelinesHandler(req: Request, res: Response): Promise<void> {
  const data = await getPipelines(req.auth!.companyId);
  res.json(data);
}

export async function postCreateOpportunityItem(req: Request, res: Response): Promise<void> {
  if (!hasPermission(req, PERMISSIONS.OPPORTUNITIES_ITEMS_CREATE)) {
    res.status(403).json(abcError("No tiene permisos para crear ítems de oportunidad"));
    return;
  }

  const oppId = Number(req.params.opportunityId);
  const body = req.body ?? {};
  const input = opportunityItemSchema.parse(body);
  const id = await createOpportunityItem(req.auth!.companyId, oppId, input);
  res.json({ resultado: 1, msg: "Ítem creado correctamente", opportunity_item_id: id });
}

export async function postUpdateOpportunityItem(req: Request, res: Response): Promise<void> {
  if (!hasPermission(req, PERMISSIONS.OPPORTUNITIES_ITEMS_UPDATE)) {
    res.status(403).json(abcError("No tiene permisos para actualizar ítems de oportunidad"));
    return;
  }

  const oppId = Number(req.params.opportunityId);
  const itemId = Number(req.params.itemId);
  const body = req.body ?? {};
  const input = opportunityItemSchema.parse(body);
  await updateOpportunityItem(req.auth!.companyId, oppId, itemId, input);
  res.json(abcSuccess("Ítem actualizado correctamente"));
}

export async function postDeleteOpportunityItem(req: Request, res: Response): Promise<void> {
  if (!hasPermission(req, PERMISSIONS.OPPORTUNITIES_ITEMS_DELETE)) {
    res.status(403).json(abcError("No tiene permisos para eliminar ítems de oportunidad"));
    return;
  }

  const oppId = Number(req.params.opportunityId);
  const itemId = Number(req.params.itemId);
  await deleteOpportunityItem(req.auth!.companyId, oppId, itemId);
  res.json(abcSuccess("Ítem eliminado correctamente"));
}
