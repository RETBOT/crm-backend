import { getPool, sql } from "../../db/sqlserver";
import { HttpError } from "../../shared/http-error";
import { EffectiveScope, resolveUserScope } from "../scope/scope.service";
import {
  ContactsAbcInput,
  ContactsInput,
  ConvertProspectInput,
  CustomersAbcInput,
  CustomersInput,
} from "./customers.schemas";

function buildScopeConditionSql(alias: string): string {
  return `
    (
      @scope_type = 'ALL'
      OR (
        ${alias}.branch_id IN (
          SELECT TRY_CAST(value AS INT)
          FROM STRING_SPLIT(@branch_ids_csv, ',')
          WHERE TRY_CAST(value AS INT) IS NOT NULL
        )
        AND (
          @scope_type = 'BRANCH'
          OR ${alias}.route_id IN (
            SELECT TRY_CAST(value AS INT)
            FROM STRING_SPLIT(@route_ids_csv, ',')
            WHERE TRY_CAST(value AS INT) IS NOT NULL
          )
        )
      )
    )
  `;
}

async function assertCustomerInScope(
  companyId: number,
  userId: number,
  customerCode: string,
  scope?: EffectiveScope
): Promise<number> {
  const pool = await getPool();
  const resolvedScope = scope ?? (await resolveUserScope(companyId, userId));

  const result = await pool
    .request()
    .input("company_id", sql.Int, companyId)
    .input("customer_code", sql.VarChar(30), customerCode)
    .input("scope_type", sql.VarChar(10), resolvedScope.scopeType)
    .input("branch_ids_csv", sql.VarChar(sql.MAX), resolvedScope.branchIdsCsv)
    .input("route_ids_csv", sql.VarChar(sql.MAX), resolvedScope.routeIdsCsv)
    .query<{ customer_id: number }>(`
      SELECT c.customer_id
      FROM crm.customers c
      WHERE c.company_id = @company_id
        AND c.customer_code = @customer_code
        AND ${buildScopeConditionSql("c")};
    `);

  const row = result.recordset[0];
  if (!row) {
    throw new HttpError(403, "No tiene acceso a este cliente/prospecto");
  }

  return row.customer_id;
}

export async function listCustomers(companyId: number, userId: number, input: CustomersInput) {
  const pool = await getPool();
  const scope = await resolveUserScope(companyId, userId);
  const page = Math.max(1, input.NPAG || 1);
  const pageSize = input.TPAG && input.TPAG > 0 ? input.TPAG : 20;
  const offset = (page - 1) * pageSize;

  const tipo = (input.TIPO || "CLIENTE").toUpperCase();
  const customerType = tipo === "PROSPECTO" ? "PROSPECTO" : tipo === "CLIENTE" ? "CLIENTE" : null;

  const whereTipo = customerType ? "AND TIPO = @tipo" : "";

  const countResult = await pool
    .request()
    .input("company_id", sql.Int, companyId)
    .input("scope_type", sql.VarChar(10), scope.scopeType)
    .input("branch_ids_csv", sql.VarChar(sql.MAX), scope.branchIdsCsv)
    .input("route_ids_csv", sql.VarChar(sql.MAX), scope.routeIdsCsv)
    .input("clienteid", sql.VarChar(30), `%${input.CLIENTEID || ""}%`)
    .input("nombre", sql.NVarChar(180), `%${input.NOMBRECLI || ""}%`)
    .input("sucursal", sql.VarChar(50), String(input.SUCURSAL || ""))
    .input("estatus", sql.VarChar(20), String(input.ESTATUS || ""))
    .input("ruta", sql.VarChar(50), String(input.RUTA || ""))
    .input("tipo", sql.VarChar(15), customerType)
    .query<{ total: number }>(`
      SELECT COUNT(1) AS total
      FROM api.vw_cn_clientes
      WHERE company_id = @company_id
        AND EXISTS (
          SELECT 1
          FROM crm.customers cscope
          WHERE cscope.company_id = api.vw_cn_clientes.company_id
            AND cscope.customer_id = api.vw_cn_clientes.customer_id
            AND ${buildScopeConditionSql("cscope")}
        )
        AND CLIENTEID LIKE @clienteid
        AND NOMBRECLI LIKE @nombre
        AND (@sucursal = '' OR SUCURSAL = @sucursal)
        AND (@estatus = '' OR ESTATUS = @estatus)
        AND (@ruta = '' OR CAST(RUTAID AS VARCHAR(50)) = @ruta)
        ${whereTipo};
    `);

  const total = countResult.recordset[0]?.total ?? 0;
  const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(total / pageSize)) : 1;

  const dataResult = await pool
    .request()
    .input("company_id", sql.Int, companyId)
    .input("scope_type", sql.VarChar(10), scope.scopeType)
    .input("branch_ids_csv", sql.VarChar(sql.MAX), scope.branchIdsCsv)
    .input("route_ids_csv", sql.VarChar(sql.MAX), scope.routeIdsCsv)
    .input("clienteid", sql.VarChar(30), `%${input.CLIENTEID || ""}%`)
    .input("nombre", sql.NVarChar(180), `%${input.NOMBRECLI || ""}%`)
    .input("sucursal", sql.VarChar(50), String(input.SUCURSAL || ""))
    .input("estatus", sql.VarChar(20), String(input.ESTATUS || ""))
    .input("ruta", sql.VarChar(50), String(input.RUTA || ""))
    .input("tipo", sql.VarChar(15), customerType)
    .input("offset", sql.Int, offset)
    .input("page_size", sql.Int, pageSize)
    .query(`
      SELECT *
      FROM api.vw_cn_clientes
      WHERE company_id = @company_id
        AND EXISTS (
          SELECT 1
          FROM crm.customers cscope
          WHERE cscope.company_id = api.vw_cn_clientes.company_id
            AND cscope.customer_id = api.vw_cn_clientes.customer_id
            AND ${buildScopeConditionSql("cscope")}
        )
        AND CLIENTEID LIKE @clienteid
        AND NOMBRECLI LIKE @nombre
        AND (@sucursal = '' OR SUCURSAL = @sucursal)
        AND (@estatus = '' OR ESTATUS = @estatus)
        AND (@ruta = '' OR CAST(RUTAID AS VARCHAR(50)) = @ruta)
        ${whereTipo}
      ORDER BY NOMBRECLI
      OFFSET @offset ROWS FETCH NEXT @page_size ROWS ONLY;
    `);

  return {
    data: dataResult.recordset,
    tot_pags: totalPages,
    total_regs: total,
  };
}

export async function listContacts(companyId: number, userId: number, input: ContactsInput) {
  const pool = await getPool();
  const scope = await resolveUserScope(companyId, userId);
  const result = await pool
    .request()
    .input("company_id", sql.Int, companyId)
    .input("scope_type", sql.VarChar(10), scope.scopeType)
    .input("branch_ids_csv", sql.VarChar(sql.MAX), scope.branchIdsCsv)
    .input("route_ids_csv", sql.VarChar(sql.MAX), scope.routeIdsCsv)
    .input("clienteid", sql.VarChar(30), input.CLIENTEID)
    .query(`
      SELECT ID, NOMBRE, APATERNO, AMATERNO, TELEFONO, EXTENSION, PUESTOID, PUESTO, COMENTARIOS, WHATSAPP, EMAIL
      FROM api.vw_cn_contactos
      WHERE company_id = @company_id
        AND CLIENTEID = @clienteid
        AND EXISTS (
          SELECT 1
          FROM crm.customers cscope
          WHERE cscope.company_id = api.vw_cn_contactos.company_id
            AND cscope.customer_id = api.vw_cn_contactos.customer_id
            AND ${buildScopeConditionSql("cscope")}
        )
        AND is_active = 1
      ORDER BY NOMBRE, APATERNO, AMATERNO;
    `);

  return result.recordset;
}

export async function contactsAbc(companyId: number, userId: number, input: ContactsAbcInput): Promise<string> {
  const pool = await getPool();
  const scope = await resolveUserScope(companyId, userId);
  const customerId = await assertCustomerInScope(companyId, userId, input.CLIENTEID, scope);

  if (input.TIPO === "A") {
    await pool
      .request()
      .input("company_id", sql.Int, companyId)
      .input("customer_id", sql.Int, customerId)
      .input("first_name", sql.NVarChar(100), input.NOMBRE || "")
      .input("last_name", sql.NVarChar(100), input.APATERNO || "")
      .input("second_last_name", sql.NVarChar(100), input.AMATERNO || "")
      .input("phone", sql.VarChar(30), input.TELEFONO || "")
      .input("extension", sql.VarChar(10), input.EXTENSION || "")
      .input("position_code", sql.Char(2), input.PUESTOID || null)
      .input("comments", sql.NVarChar(500), input.COMENTARIOS || "")
      .input("whatsapp", sql.VarChar(30), input.WHATSAPP || "")
      .input("email", sql.NVarChar(160), input.EMAIL || "")
      .query(`
        INSERT INTO crm.contacts (
          company_id, customer_id, first_name, last_name, second_last_name,
          phone, extension, position_code, comments, whatsapp, email, is_active
        ) VALUES (
          @company_id, @customer_id, @first_name, @last_name, @second_last_name,
          @phone, @extension, @position_code, @comments, @whatsapp, @email, 1
        );
      `);
    return "Contacto agregado correctamente";
  }

  if (input.CONTACTOID <= 0) {
    throw new HttpError(400, "CONTACTOID inválido");
  }

  if (input.TIPO === "C") {
    await pool
      .request()
      .input("company_id", sql.Int, companyId)
      .input("contact_id", sql.Int, input.CONTACTOID)
      .input("first_name", sql.NVarChar(100), input.NOMBRE || "")
      .input("last_name", sql.NVarChar(100), input.APATERNO || "")
      .input("second_last_name", sql.NVarChar(100), input.AMATERNO || "")
      .input("phone", sql.VarChar(30), input.TELEFONO || "")
      .input("extension", sql.VarChar(10), input.EXTENSION || "")
      .input("position_code", sql.Char(2), input.PUESTOID || null)
      .input("comments", sql.NVarChar(500), input.COMENTARIOS || "")
      .input("whatsapp", sql.VarChar(30), input.WHATSAPP || "")
      .input("email", sql.NVarChar(160), input.EMAIL || "")
      .query(`
        UPDATE crm.contacts
           SET first_name = @first_name,
               last_name = @last_name,
               second_last_name = @second_last_name,
               phone = @phone,
               extension = @extension,
               position_code = @position_code,
               comments = @comments,
               whatsapp = @whatsapp,
               email = @email,
               updated_at = SYSUTCDATETIME()
         WHERE company_id = @company_id
           AND contact_id = @contact_id;
      `);
    return "Contacto actualizado correctamente";
  }

  await pool
    .request()
    .input("company_id", sql.Int, companyId)
    .input("contact_id", sql.Int, input.CONTACTOID)
    .query(`
      UPDATE crm.contacts
         SET is_active = 0,
             updated_at = SYSUTCDATETIME()
       WHERE company_id = @company_id
         AND contact_id = @contact_id;
    `);

  return "Contacto eliminado correctamente";
}

async function getNextCustomerCode(companyId: number): Promise<string> {
  const pool = await getPool();
  const result = await pool.request().input("company_id", sql.Int, companyId).query<{ next_code: number }>(`
    SELECT ISNULL(MAX(TRY_CONVERT(INT, customer_code)), 100000) + 1 AS next_code
    FROM crm.customers
    WHERE company_id = @company_id;
  `);

  return String(result.recordset[0]?.next_code ?? 100001);
}

export async function customersAbc(companyId: number, userId: number, input: CustomersAbcInput): Promise<string> {
  const pool = await getPool();
  const scope = await resolveUserScope(companyId, userId);
  const branchId = input.SUCURSAL || null;
  const routeId = input.RUTA || null;

  if (input.TIPO === "A" || input.TIPO === "C") {
    if (scope.scopeType !== "ALL") {
      if (!branchId || !scope.branchIds.includes(branchId)) {
        throw new HttpError(403, "No tiene acceso a la sucursal seleccionada");
      }

      if (scope.scopeType === "ROUTE") {
        if (!routeId || !scope.routeIds.includes(routeId)) {
          throw new HttpError(403, "No tiene acceso a la ruta seleccionada");
        }
      }
    }
  }

  if (input.TIPO === "A") {
    const customerCode = input.CLIENTEID && input.CLIENTEID.trim() ? input.CLIENTEID.trim() : await getNextCustomerCode(companyId);

    await pool
      .request()
      .input("company_id", sql.Int, companyId)
      .input("customer_code", sql.VarChar(30), customerCode)
      .input("customer_name", sql.NVarChar(180), input.NOMBRECLI)
      .input("customer_type", sql.VarChar(15), input.TIPO_CLIENTE)
      .input("business_line", sql.NVarChar(120), input.GIRO || null)
      .input("status", sql.VarChar(10), input.ESTATUS || "ACTIVO")
      .input("branch_id", sql.Int, branchId)
      .input("route_id", sql.Int, routeId)
      .input("street", sql.NVarChar(120), input.CALLE || null)
      .input("ext_number", sql.NVarChar(20), input.NUM_EXT || null)
      .input("neighborhood", sql.NVarChar(120), input.COLONIA || null)
      .input("city", sql.NVarChar(120), input.CIUDAD || null)
      .input("state", sql.NVarChar(120), input.ESTADO || null)
      .input("email", sql.NVarChar(160), input.EMAIL || null)
      .input("phone", sql.VarChar(30), input.TEL || null)
      .input("latitude", sql.Decimal(9, 6), input.LAT ?? null)
      .input("longitude", sql.Decimal(9, 6), input.LON ?? null)
      .query(`
        INSERT INTO crm.customers (
          company_id, customer_code, customer_name, customer_type, business_line, status,
          branch_id, route_id, street, ext_number, neighborhood, city, state,
          email, phone, latitude, longitude, created_at, updated_at
        )
        VALUES (
          @company_id, @customer_code, @customer_name, @customer_type, @business_line, @status,
          @branch_id, @route_id, @street, @ext_number, @neighborhood, @city, @state,
          @email, @phone, @latitude, @longitude, SYSUTCDATETIME(), SYSUTCDATETIME()
        );
      `);

    return input.TIPO_CLIENTE === "PROSPECTO" ? "Prospecto creado correctamente" : "Cliente creado correctamente";
  }

  if (!input.CLIENTEID) {
    throw new HttpError(400, "CLIENTEID es requerido");
  }

  await assertCustomerInScope(companyId, userId, input.CLIENTEID, scope);

  if (input.TIPO === "C") {
    await pool
      .request()
      .input("company_id", sql.Int, companyId)
      .input("customer_code", sql.VarChar(30), input.CLIENTEID)
      .input("customer_name", sql.NVarChar(180), input.NOMBRECLI)
      .input("customer_type", sql.VarChar(15), input.TIPO_CLIENTE)
      .input("business_line", sql.NVarChar(120), input.GIRO || null)
      .input("status", sql.VarChar(10), input.ESTATUS || "ACTIVO")
      .input("branch_id", sql.Int, branchId)
      .input("route_id", sql.Int, routeId)
      .input("street", sql.NVarChar(120), input.CALLE || null)
      .input("ext_number", sql.NVarChar(20), input.NUM_EXT || null)
      .input("neighborhood", sql.NVarChar(120), input.COLONIA || null)
      .input("city", sql.NVarChar(120), input.CIUDAD || null)
      .input("state", sql.NVarChar(120), input.ESTADO || null)
      .input("email", sql.NVarChar(160), input.EMAIL || null)
      .input("phone", sql.VarChar(30), input.TEL || null)
      .input("latitude", sql.Decimal(9, 6), input.LAT ?? null)
      .input("longitude", sql.Decimal(9, 6), input.LON ?? null)
      .query(`
        UPDATE crm.customers
           SET customer_name = @customer_name,
               customer_type = @customer_type,
               business_line = @business_line,
               status = @status,
               branch_id = @branch_id,
               route_id = @route_id,
               street = @street,
               ext_number = @ext_number,
               neighborhood = @neighborhood,
               city = @city,
               state = @state,
               email = @email,
               phone = @phone,
               latitude = @latitude,
               longitude = @longitude,
               updated_at = SYSUTCDATETIME()
         WHERE company_id = @company_id
           AND customer_code = @customer_code;
      `);

    return "Registro actualizado correctamente";
  }

  await pool
    .request()
    .input("company_id", sql.Int, companyId)
    .input("customer_code", sql.VarChar(30), input.CLIENTEID)
    .query(`
      UPDATE crm.customers
         SET status = 'INACTIVO',
             updated_at = SYSUTCDATETIME()
       WHERE company_id = @company_id
         AND customer_code = @customer_code;
    `);

  return "Registro inactivado correctamente";
}

export async function convertProspectToCustomer(companyId: number, userId: number, input: ConvertProspectInput): Promise<string> {
  const pool = await getPool();
  const scope = await resolveUserScope(companyId, userId);

  await assertCustomerInScope(companyId, userId, input.CLIENTEID, scope);

  const current = await pool
    .request()
    .input("company_id", sql.Int, companyId)
    .input("customer_code", sql.VarChar(30), input.CLIENTEID)
    .query<{ customer_type: string }>(`
      SELECT customer_type
      FROM crm.customers
      WHERE company_id = @company_id
        AND customer_code = @customer_code;
    `);

  if (!current.recordset[0]) {
    throw new HttpError(404, "Prospecto no encontrado");
  }

  if (current.recordset[0].customer_type === "CLIENTE") {
    return "El registro ya es cliente";
  }

  await pool
    .request()
    .input("company_id", sql.Int, companyId)
    .input("customer_code", sql.VarChar(30), input.CLIENTEID)
    .query(`
      UPDATE crm.customers
         SET customer_type = 'CLIENTE',
             status = 'ACTIVO',
             updated_at = SYSUTCDATETIME()
       WHERE company_id = @company_id
         AND customer_code = @customer_code;
    `);

  return "Prospecto convertido a cliente correctamente";
}
