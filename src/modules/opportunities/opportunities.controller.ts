import { Request, Response } from "express";
import { abcError, abcSuccess } from "../../shared/legacy-response";
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
  getOpportunitiesByCustomer,
  getOpportunityItems,
  getPipelines,
  listOpportunities,
  reopenOpportunity,
  setOpportunityStatus,
  updateOpportunity,
} from "./opportunities.service";

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
  const body = req.body ?? {};
  const input = opportunityCreateSchema.parse(body);
  const items = Array.isArray(body.ITEMS) ? body.ITEMS.map((i: any) => opportunityItemSchema.parse(i)) : [];
  const id = await createOpportunity(req.auth!.companyId, req.auth!.userId, input, items);
  res.json({ resultado: 1, msg: "Oportunidad creada correctamente", opportunity_id: id });
}

export async function postUpdateOpportunity(req: Request, res: Response): Promise<void> {
  const body = req.body ?? {};
  const input = opportunityUpdateSchema.parse(body);
  const items = Array.isArray(body.ITEMS) ? body.ITEMS.map((i: any) => opportunityItemSchema.parse(i)) : [];
  await updateOpportunity(req.auth!.companyId, req.auth!.userId, input, items);
  res.json(abcSuccess("Oportunidad actualizada correctamente"));
}

export async function postAdvanceStage(req: Request, res: Response): Promise<void> {
  const input = opportunityAdvanceSchema.parse(req.body ?? {});
  await advanceOpportunityStage(req.auth!.companyId, req.auth!.userId, input);
  res.json(abcSuccess("Etapa avanzada correctamente"));
}

export async function postSetStatus(req: Request, res: Response): Promise<void> {
  const input = opportunityStatusSchema.parse(req.body ?? {});
  await setOpportunityStatus(req.auth!.companyId, req.auth!.userId, input);
  const msg = input.STATUS === "ganada" ? "Oportunidad marcada como ganada" : "Oportunidad marcada como perdida";
  res.json(abcSuccess(msg));
}

export async function postReopen(req: Request, res: Response): Promise<void> {
  await reopenOpportunity(req.auth!.companyId, req.auth!.userId, req.body ?? {});
  res.json(abcSuccess("Oportunidad reabierta correctamente"));
}

export async function getPipelinesHandler(req: Request, res: Response): Promise<void> {
  const data = await getPipelines(req.auth!.companyId);
  res.json(data);
}
