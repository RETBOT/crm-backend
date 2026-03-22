import { Request, Response } from "express";
import { z } from "zod";
import { getPool, sql } from "../../db/sqlserver";
import { resolveUserScope } from "../scope/scope.service";

const querySchema = z.object({
  DESCRIPCION: z.string().optional().default(""),
});

export async function getSucursales(req: Request, res: Response): Promise<void> {
  const { DESCRIPCION } = querySchema.parse(req.body ?? {});
  const companyId = req.auth!.companyId;
  const userId = req.auth!.userId;
  const scope = await resolveUserScope(companyId, userId);
  const pool = await getPool();

  const result = await pool
    .request()
    .input("company_id", sql.Int, companyId)
    .input("scope_type", sql.VarChar(10), scope.scopeType)
    .input("branch_ids_csv", sql.VarChar(sql.MAX), scope.branchIdsCsv)
    .input("search", sql.NVarChar(120), `%${DESCRIPCION || ""}%`)
    .query(`
      SELECT ID, DSC
      FROM api.vw_cn_sucursal
      WHERE ID IN (
        SELECT branch_id FROM crm.branches WHERE company_id = @company_id
      )
      AND (
        @scope_type = 'ALL'
        OR ID IN (
          SELECT TRY_CAST(value AS INT)
          FROM STRING_SPLIT(@branch_ids_csv, ',')
          WHERE TRY_CAST(value AS INT) IS NOT NULL
        )
      )
      AND (@search = '%%' OR DSC LIKE @search)
      ORDER BY DSC;
    `);

  res.json(result.recordset);
}

export async function getRutas(req: Request, res: Response): Promise<void> {
  const { DESCRIPCION } = querySchema.parse(req.body ?? {});
  const companyId = req.auth!.companyId;
  const userId = req.auth!.userId;
  const scope = await resolveUserScope(companyId, userId);
  const pool = await getPool();

  const result = await pool
    .request()
    .input("company_id", sql.Int, companyId)
    .input("scope_type", sql.VarChar(10), scope.scopeType)
    .input("branch_ids_csv", sql.VarChar(sql.MAX), scope.branchIdsCsv)
    .input("route_ids_csv", sql.VarChar(sql.MAX), scope.routeIdsCsv)
    .input("branch_id", sql.Int, Number(DESCRIPCION) || null)
    .query(`
      SELECT ID, DSC, SUCURSALID
      FROM api.vw_cn_rutas
      WHERE ID IN (
        SELECT route_id FROM crm.routes WHERE company_id = @company_id
      )
      AND (
        @scope_type = 'ALL'
        OR (
          SUCURSALID IN (
            SELECT TRY_CAST(value AS INT)
            FROM STRING_SPLIT(@branch_ids_csv, ',')
            WHERE TRY_CAST(value AS INT) IS NOT NULL
          )
          AND (
            @scope_type = 'BRANCH'
            OR ID IN (
              SELECT TRY_CAST(value AS INT)
              FROM STRING_SPLIT(@route_ids_csv, ',')
              WHERE TRY_CAST(value AS INT) IS NOT NULL
            )
          )
        )
      )
      AND (@branch_id IS NULL OR SUCURSALID = @branch_id)
      ORDER BY DSC;
    `);

  res.json(result.recordset);
}
