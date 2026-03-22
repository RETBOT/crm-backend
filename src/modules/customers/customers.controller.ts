import { Request, Response } from "express";
import { abcError, abcSuccess } from "../../shared/legacy-response";
import { PERMISSIONS } from "../auth/permissions";
import {
  contactsAbcSchema,
  contactsSchema,
  convertProspectSchema,
  customersAbcSchema,
  customersSchema,
} from "./customers.schemas";
import {
  contactsAbc,
  convertProspectToCustomer,
  customersAbc,
  listContacts,
  listCustomers,
} from "./customers.service";

function hasPermission(req: Request, permission: string): boolean {
  return !!req.auth?.permissions?.includes(permission);
}

export async function getCustomers(req: Request, res: Response): Promise<void> {
  const input = customersSchema.parse(req.body ?? {});
  const data = await listCustomers(req.auth!.companyId, req.auth!.userId, input);
  res.json(data);
}

export async function getContacts(req: Request, res: Response): Promise<void> {
  const input = contactsSchema.parse(req.body ?? {});
  const data = await listContacts(req.auth!.companyId, req.auth!.userId, input);
  res.json(data);
}

export async function postContactsAbc(req: Request, res: Response): Promise<void> {
  const input = contactsAbcSchema.parse(req.body ?? {});

  try {
    const msg = await contactsAbc(req.auth!.companyId, req.auth!.userId, input);
    res.json(abcSuccess(msg));
  } catch (error) {
    const msg = error instanceof Error ? error.message : "No se pudo completar la operación";
    res.status(400).json(abcError(msg));
  }
}

export async function postCustomersAbc(req: Request, res: Response): Promise<void> {
  const input = customersAbcSchema.parse(req.body ?? {});

  try {
    const type = input.TIPO_CLIENTE === "PROSPECTO" ? "PROSPECTO" : "CLIENTE";
    const permissionMap =
      type === "PROSPECTO"
        ? {
            A: PERMISSIONS.PROSPECTS_CREATE,
            C: PERMISSIONS.PROSPECTS_UPDATE,
            B: PERMISSIONS.PROSPECTS_DELETE,
          }
        : {
            A: PERMISSIONS.CUSTOMERS_CREATE,
            C: PERMISSIONS.CUSTOMERS_UPDATE,
            B: PERMISSIONS.CUSTOMERS_DELETE,
          };

    const requiredPermission = permissionMap[input.TIPO];
    if (!hasPermission(req, requiredPermission)) {
      res.status(403).json(abcError("No cuenta con permisos para esta acción"));
      return;
    }

    const msg = await customersAbc(req.auth!.companyId, req.auth!.userId, input);
    res.json(abcSuccess(msg));
  } catch (error) {
    const msg = error instanceof Error ? error.message : "No se pudo completar la operación";
    res.status(400).json(abcError(msg));
  }
}

export async function postConvertProspect(req: Request, res: Response): Promise<void> {
  const input = convertProspectSchema.parse(req.body ?? {});

  try {
    if (!hasPermission(req, PERMISSIONS.PROSPECTS_CONVERT)) {
      res.status(403).json(abcError("No cuenta con permisos para convertir prospectos"));
      return;
    }

    const msg = await convertProspectToCustomer(req.auth!.companyId, req.auth!.userId, input);
    res.json(abcSuccess(msg));
  } catch (error) {
    const msg = error instanceof Error ? error.message : "No se pudo convertir el prospecto";
    res.status(400).json(abcError(msg));
  }
}
