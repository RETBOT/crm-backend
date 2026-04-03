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

  const type = (input.TIPO || "CLIENTE").toUpperCase();
  const requiredPermission = type === "PROSPECTO" ? PERMISSIONS.PROSPECTS_READ : PERMISSIONS.CUSTOMERS_READ;
  if (!hasPermission(req, requiredPermission)) {
    res.status(403).json(abcError("No cuenta con permisos para ver los clientes"));
    return;
  }

  const data = await listCustomers(req.auth!.companyId, req.auth!.userId, input);
  res.json(data);
}

export async function getContacts(req: Request, res: Response): Promise<void> {
  const input = contactsSchema.parse(req.body ?? {});

  if (!hasPermission(req, PERMISSIONS.CUSTOMERS_READ)) {
    res.status(403).json(abcError("No cuenta con permisos para ver los contactos"));
    return;
  }

  const data = await listContacts(req.auth!.companyId, req.auth!.userId, input);
  res.json(data);
}

export async function postContactsAbc(req: Request, res: Response): Promise<void> {
  const input = contactsAbcSchema.parse(req.body ?? {});

  if (!hasPermission(req, PERMISSIONS.CUSTOMERS_UPDATE)) {
    res.status(403).json(abcError("No cuenta con permisos para gestionar contactos"));
    return;
  }

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
    let requiredPermission: string;

    if (input.TIPO === "A") {
      requiredPermission = input.TIPO_CLIENTE === "PROSPECTO"
        ? PERMISSIONS.PROSPECTS_CREATE
        : PERMISSIONS.CUSTOMERS_CREATE;
    } else {
      const actualType = await getActualCustomerType(req.auth!.companyId, input.CLIENTEID);
      if (actualType === "PROSPECTO") {
        requiredPermission = input.TIPO === "C" ? PERMISSIONS.PROSPECTS_UPDATE : PERMISSIONS.PROSPECTS_DELETE;
      } else {
        requiredPermission = input.TIPO === "C" ? PERMISSIONS.CUSTOMERS_UPDATE : PERMISSIONS.CUSTOMERS_DELETE;
      }
    }

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

async function getActualCustomerType(companyId: number, customerCode: string): Promise<string | null> {
  if (!customerCode || !customerCode.trim()) return null;
  const { getPool, sql } = await import("../../db/sqlserver");
  const pool = await getPool();
  const result = await pool.request()
    .input("company_id", sql.Int, companyId)
    .input("customer_code", sql.VarChar(30), customerCode)
    .query<{ customer_type: string }>(`
      SELECT customer_type FROM crm.customers
      WHERE company_id = @company_id AND customer_code = @customer_code;
    `);
  return result.recordset[0]?.customer_type ?? null;
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
