import { getPool, sql } from "../../db/sqlserver";
import { HttpError } from "../../shared/http-error";
import { resolveUserScope } from "../scope/scope.service";
import {
  OpportunitiesListInput,
  OpportunityAdvanceInput,
  OpportunityCreateInput,
  OpportunityItemInput,
  OpportunityStatusInput,
  OpportunityUpdateInput,
} from "./opportunities.schemas";

function buildScopeConditionSql(alias: string): string {
  return `
    EXISTS (
      SELECT 1
      FROM crm.customers cscope
      WHERE cscope.company_id = ${alias}.company_id
        AND cscope.customer_id = ${alias}.customer_id
        AND (
          @scope_type = 'ALL'
          OR (
            cscope.branch_id IN (
              SELECT TRY_CAST(value AS INT)
              FROM STRING_SPLIT(@branch_ids_csv, ',')
              WHERE TRY_CAST(value AS INT) IS NOT NULL
            )
            AND (
              @scope_type = 'BRANCH'
              OR cscope.route_id IN (
                SELECT TRY_CAST(value AS INT)
                FROM STRING_SPLIT(@route_ids_csv, ',')
                WHERE TRY_CAST(value AS INT) IS NOT NULL
              )
            )
          )
        )
    )
  `;
}

async function assertCustomerInScope(companyId: number, userId: number, customerId: number): Promise<void> {
  const pool = await getPool();
  const scope = await resolveUserScope(companyId, userId);

  const result = await pool
    .request()
    .input("company_id", sql.Int, companyId)
    .input("customer_id", sql.Int, customerId)
    .input("scope_type", sql.VarChar(10), scope.scopeType)
    .input("branch_ids_csv", sql.VarChar(sql.MAX), scope.branchIdsCsv)
    .input("route_ids_csv", sql.VarChar(sql.MAX), scope.routeIdsCsv)
    .query(`
      SELECT 1 FROM crm.customers c
      WHERE c.company_id = @company_id AND c.customer_id = @customer_id
        AND (
          @scope_type = 'ALL'
          OR (
            c.branch_id IN (
              SELECT TRY_CAST(value AS INT) FROM STRING_SPLIT(@branch_ids_csv, ',')
              WHERE TRY_CAST(value AS INT) IS NOT NULL
            )
            AND (
              @scope_type = 'BRANCH'
              OR c.route_id IN (
                SELECT TRY_CAST(value AS INT) FROM STRING_SPLIT(@route_ids_csv, ',')
                WHERE TRY_CAST(value AS INT) IS NOT NULL
              )
            )
          )
        );
    `);

  if (!result.recordset[0]) {
    throw new HttpError(403, "No tiene acceso a este cliente");
  }
}

export async function listOpportunities(companyId: number, userId: number, input: OpportunitiesListInput) {
  const pool = await getPool();
  const scope = await resolveUserScope(companyId, userId);
  const page = Math.max(1, input.NPAG || 1);
  const pageSize = input.TPAG && input.TPAG > 0 ? input.TPAG : 20;
  const offset = (page - 1) * pageSize;

  const whereCustomer = input.CUSTOMER_ID ? "AND o.customer_id = @customer_id" : "";
  const whereStatus = input.STATUS ? "AND o.status = @status" : "";
  const whereStage = input.STAGE_ID ? "AND o.stage_id = @stage_id" : "";
  const whereOwner = input.OWNER_USER_ID ? "AND o.owner_user_id = @owner_id" : "";
  const whereDateFrom = input.CLOSE_DATE_FROM ? "AND o.close_date >= @close_date_from" : "";
  const whereDateTo = input.CLOSE_DATE_TO ? "AND o.close_date <= @close_date_to" : "";
  const whereSearch = input.SEARCH ? "AND (o.title LIKE @search OR c.customer_name LIKE @search OR o.description LIKE @search)" : "";
  const scopeSql = buildScopeConditionSql("o");

  const countResult = await pool
    .request()
    .input("company_id", sql.Int, companyId)
    .input("scope_type", sql.VarChar(10), scope.scopeType)
    .input("branch_ids_csv", sql.VarChar(sql.MAX), scope.branchIdsCsv)
    .input("route_ids_csv", sql.VarChar(sql.MAX), scope.routeIdsCsv)
    .input("customer_id", sql.Int, input.CUSTOMER_ID ?? null)
    .input("status", sql.VarChar(20), input.STATUS || "")
    .input("stage_id", sql.Int, input.STAGE_ID ?? null)
    .input("owner_id", sql.Int, input.OWNER_USER_ID ?? null)
    .input("close_date_from", sql.Date, input.CLOSE_DATE_FROM ? new Date(input.CLOSE_DATE_FROM) : null)
    .input("close_date_to", sql.Date, input.CLOSE_DATE_TO ? new Date(input.CLOSE_DATE_TO + "T23:59:59") : null)
    .input("search", sql.NVarChar(200), input.SEARCH ? `%${input.SEARCH}%` : "")
    .query<{ total: number }>(`
      SELECT COUNT(1) AS total FROM crm.opportunities o
      INNER JOIN crm.customers c ON c.company_id = o.company_id AND c.customer_id = o.customer_id
      WHERE o.company_id = @company_id AND ${scopeSql} ${whereCustomer} ${whereStatus} ${whereStage} ${whereOwner} ${whereDateFrom} ${whereDateTo} ${whereSearch};
    `);

  const total = countResult.recordset[0]?.total ?? 0;
  const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(total / pageSize)) : 1;

  const sortBy = input.SORT_BY || "stage_order";
  const sortDir = input.SORT_DIR || "ASC";
  const orderBy = sortBy === "amount" ? `o.amount ${sortDir}`
    : sortBy === "close_date" ? `o.close_date ${sortDir}`
    : sortBy === "probability" ? `o.probability_pct ${sortDir}`
    : sortBy === "status" ? `o.status ${sortDir}`
    : `ps.stage_order ASC, o.created_at DESC`;

  const dataResult = await pool
    .request()
    .input("company_id", sql.Int, companyId)
    .input("scope_type", sql.VarChar(10), scope.scopeType)
    .input("branch_ids_csv", sql.VarChar(sql.MAX), scope.branchIdsCsv)
    .input("route_ids_csv", sql.VarChar(sql.MAX), scope.routeIdsCsv)
    .input("customer_id", sql.Int, input.CUSTOMER_ID ?? null)
    .input("status", sql.VarChar(20), input.STATUS || "")
    .input("stage_id", sql.Int, input.STAGE_ID ?? null)
    .input("owner_id", sql.Int, input.OWNER_USER_ID ?? null)
    .input("close_date_from", sql.Date, input.CLOSE_DATE_FROM ? new Date(input.CLOSE_DATE_FROM) : null)
    .input("close_date_to", sql.Date, input.CLOSE_DATE_TO ? new Date(input.CLOSE_DATE_TO + "T23:59:59") : null)
    .input("search", sql.NVarChar(200), input.SEARCH ? `%${input.SEARCH}%` : "")
    .input("offset", sql.Int, offset)
    .input("page_size", sql.Int, pageSize)
    .query(`
      SELECT
        o.opportunity_id AS OPPORTUNITYID, o.customer_id AS CUSTOMER_ID, c.customer_name AS NOMBRECLI,
        o.contact_id AS CONTACT_ID, ct.first_name + ' ' + ct.last_name AS CONTACT_NAME,
        o.owner_user_id AS OWNER_ID, u.display_name AS OWNER_NAME,
        o.pipeline_id AS PIPELINE_ID, o.stage_id AS STAGE_ID,
        ps.stage_name AS STAGE_NAME, ps.stage_order AS STAGE_ORDER,
        ps.is_closed AS IS_CLOSED, ps.is_won AS IS_WON,
        o.title AS TITLE, o.description AS DESCRIPTION,
        o.amount AS AMOUNT, o.close_date AS CLOSE_DATE,
        o.probability_pct AS PROBABILITY, o.status AS STATUS,
        o.lost_reason AS LOST_REASON, o.created_at AS CREATED_AT
      FROM crm.opportunities o
      INNER JOIN crm.customers c ON c.company_id = o.company_id AND c.customer_id = o.customer_id
      LEFT JOIN crm.contacts ct ON ct.company_id = o.company_id AND ct.contact_id = o.contact_id
      LEFT JOIN sec.users u ON u.company_id = o.company_id AND u.user_id = o.owner_user_id
      LEFT JOIN crm.pipeline_stages ps ON ps.stage_id = o.stage_id
      WHERE o.company_id = @company_id AND ${scopeSql} ${whereCustomer} ${whereStatus} ${whereStage} ${whereOwner} ${whereDateFrom} ${whereDateTo} ${whereSearch}
      ORDER BY ${orderBy}
      OFFSET @offset ROWS FETCH NEXT @page_size ROWS ONLY;
    `);

  return { data: dataResult.recordset, tot_pags: totalPages, total_regs: total };
}

export async function getOpportunityItems(companyId: number, userId: number, opportunityId: number) {
  const pool = await getPool();

  // Verify user has access to this opportunity's customer
  const oppCheck = await pool
    .request()
    .input("company_id", sql.Int, companyId)
    .input("opportunity_id", sql.Int, opportunityId)
    .query<{ customer_id: number }>(`
      SELECT customer_id FROM crm.opportunities
      WHERE company_id = @company_id AND opportunity_id = @opportunity_id;
    `);

  if (!oppCheck.recordset[0]) throw new HttpError(404, "Oportunidad no encontrada");
  await assertCustomerInScope(companyId, userId, oppCheck.recordset[0].customer_id);

  const result = await pool
    .request()
    .input("company_id", sql.Int, companyId)
    .input("opportunity_id", sql.Int, opportunityId)
    .query(`
      SELECT oi.opportunity_item_id AS ITEM_ID, oi.product_id AS PRODUCT_ID,
             p.sku AS SKU, p.product_name AS PRODUCT_NAME,
             oi.item_description AS ITEM_DESCRIPTION, oi.quantity AS QUANTITY,
             oi.unit_price AS UNIT_PRICE, oi.discount_pct AS DISCOUNT_PCT,
             CAST(oi.quantity * oi.unit_price * (1 - oi.discount_pct / 100) AS DECIMAL(18,2)) AS LINE_TOTAL
      FROM crm.opportunity_items oi
      LEFT JOIN crm.products p ON p.company_id = oi.company_id AND p.product_id = oi.product_id
      WHERE oi.company_id = @company_id AND oi.opportunity_id = @opportunity_id
      ORDER BY oi.opportunity_item_id;
    `);
  return result.recordset;
}

export async function createOpportunity(companyId: number, userId: number, input: OpportunityCreateInput, items: OpportunityItemInput[] = []) {
  const pool = await getPool();
  await assertCustomerInScope(companyId, userId, input.CUSTOMER_ID);

  const tx = new sql.Transaction(pool);
  await tx.begin();

  try {
    const firstStageResult = await new sql.Request(tx)
      .input("company_id", sql.Int, companyId)
      .input("pipeline_id", sql.Int, input.PIPELINE_ID)
      .query<{ stage_id: number }>(`
        SELECT TOP 1 stage_id FROM crm.pipeline_stages
        WHERE company_id = @company_id AND pipeline_id = @pipeline_id
        ORDER BY stage_order ASC;
      `);

    const stageId = firstStageResult.recordset[0]?.stage_id;

    const insertResult = await new sql.Request(tx)
      .input("company_id", sql.Int, companyId)
      .input("customer_id", sql.Int, input.CUSTOMER_ID)
      .input("contact_id", sql.Int, input.CONTACT_ID ?? null)
      .input("owner_user_id", sql.Int, userId)
      .input("pipeline_id", sql.Int, input.PIPELINE_ID)
      .input("stage_id", sql.Int, stageId)
      .input("title", sql.NVarChar(180), input.TITLE)
      .input("description", sql.NVarChar(1000), input.DESCRIPTION || "")
      .input("amount", sql.Decimal(18, 2), input.AMOUNT || 0)
      .input("close_date", sql.Date, input.CLOSE_DATE ? new Date(input.CLOSE_DATE) : null)
      .input("probability_pct", sql.Decimal(5, 2), input.PROBABILITY || 0)
      .query<{ opportunity_id: number }>(`
        INSERT INTO crm.opportunities (
          company_id, customer_id, contact_id, owner_user_id, pipeline_id, stage_id,
          title, description, amount, close_date, probability_pct, status
        ) OUTPUT INSERTED.opportunity_id VALUES (
          @company_id, @customer_id, @contact_id, @owner_user_id, @pipeline_id, @stage_id,
          @title, @description, @amount, @close_date, @probability_pct, 'abierta'
        );
      `);

    const opportunityId = insertResult.recordset[0].opportunity_id;

    for (const item of items) {
      await new sql.Request(tx)
        .input("company_id", sql.Int, companyId)
        .input("opportunity_id", sql.Int, opportunityId)
        .input("product_id", sql.Int, item.PRODUCT_ID ?? null)
        .input("item_description", sql.NVarChar(200), item.ITEM_DESCRIPTION || "")
        .input("quantity", sql.Decimal(12, 2), item.QUANTITY || 1)
        .input("unit_price", sql.Decimal(18, 2), item.UNIT_PRICE || 0)
        .input("discount_pct", sql.Decimal(5, 2), item.DISCOUNT_PCT || 0)
        .query(`
          INSERT INTO crm.opportunity_items (company_id, opportunity_id, product_id, item_description, quantity, unit_price, discount_pct)
          VALUES (@company_id, @opportunity_id, @product_id, @item_description, @quantity, @unit_price, @discount_pct);
        `);
    }

    await tx.commit();
    return opportunityId;
  } catch (error) {
    await tx.rollback();
    throw error;
  }
}

export async function updateOpportunity(companyId: number, userId: number, input: OpportunityUpdateInput, items: OpportunityItemInput[] = []) {
  const pool = await getPool();

  const existing = await pool
    .request()
    .input("company_id", sql.Int, companyId)
    .input("opportunity_id", sql.Int, input.OPPORTUNITY_ID)
    .query<{ customer_id: number; status: string; pipeline_id: number; stage_id: number }>(`
      SELECT customer_id, status, pipeline_id, stage_id FROM crm.opportunities
      WHERE company_id = @company_id AND opportunity_id = @opportunity_id;
    `);

  if (!existing.recordset[0]) throw new HttpError(404, "Oportunidad no encontrada");
  if (existing.recordset[0].status !== "abierta") throw new HttpError(400, "Solo se pueden editar oportunidades abiertas");

  await assertCustomerInScope(companyId, userId, existing.recordset[0].customer_id);

  // Validate pipeline/stage if changing
  let targetPipelineId = input.PIPELINE_ID ?? existing.recordset[0].pipeline_id;
  let targetStageId = input.STAGE_ID;

  if (input.PIPELINE_ID || input.STAGE_ID) {
    if (input.STAGE_ID) {
      const stageCheck = await pool
        .request()
        .input("company_id", sql.Int, companyId)
        .input("stage_id", sql.Int, input.STAGE_ID)
        .input("pipeline_id", sql.Int, targetPipelineId)
        .query<{ stage_id: number; pipeline_id: number; is_closed: boolean }>(`
          SELECT stage_id, pipeline_id, is_closed FROM crm.pipeline_stages
          WHERE company_id = @company_id AND stage_id = @stage_id;
        `);

      if (!stageCheck.recordset[0]) throw new HttpError(404, "Etapa no encontrada");
      if (stageCheck.recordset[0].pipeline_id !== targetPipelineId) {
        throw new HttpError(400, "La etapa no pertenece al pipeline seleccionado");
      }
      if (stageCheck.recordset[0].is_closed) {
        throw new HttpError(400, "No se puede mover a una etapa cerrada");
      }
      targetStageId = stageCheck.recordset[0].stage_id;
    }
  }

  const tx = new sql.Transaction(pool);
  await tx.begin();

  try {
    await new sql.Request(tx)
      .input("company_id", sql.Int, companyId)
      .input("opportunity_id", sql.Int, input.OPPORTUNITY_ID)
      .input("contact_id", sql.Int, input.CONTACT_ID ?? null)
      .input("title", sql.NVarChar(180), input.TITLE)
      .input("description", sql.NVarChar(1000), input.DESCRIPTION || "")
      .input("amount", sql.Decimal(18, 2), input.AMOUNT || 0)
      .input("close_date", sql.Date, input.CLOSE_DATE ? new Date(input.CLOSE_DATE) : null)
      .input("probability_pct", sql.Decimal(5, 2), input.PROBABILITY || 0)
      .input("pipeline_id", sql.Int, targetPipelineId)
      .input("stage_id", sql.Int, targetStageId ?? existing.recordset[0].stage_id)
      .input("customer_id", sql.Int, input.CUSTOMER_ID ?? null)
      .query(`
        UPDATE crm.opportunities SET
          contact_id = @contact_id, title = @title, description = @description,
          amount = @amount, close_date = @close_date, probability_pct = @probability_pct,
          pipeline_id = @pipeline_id, stage_id = @stage_id,
          updated_at = SYSUTCDATETIME()
        WHERE company_id = @company_id AND opportunity_id = @opportunity_id;
      `);

    // Differential item update: only if items array is provided
    if (items.length > 0) {
      // Get existing items
      const existingItemsResult = await new sql.Request(tx)
        .input("company_id", sql.Int, companyId)
        .input("opportunity_id", sql.Int, input.OPPORTUNITY_ID)
        .query<{ opportunity_item_id: number; product_id: number }>(`
          SELECT opportunity_item_id, product_id FROM crm.opportunity_items
          WHERE company_id = @company_id AND opportunity_id = @opportunity_id;
        `);

      const existingItemIds = new Set(existingItemsResult.recordset.map((r) => r.opportunity_item_id));
      const incomingProductIds = new Set(items.filter((i) => i.PRODUCT_ID).map((i) => i.PRODUCT_ID!));

      // Delete items that are no longer in the incoming list
      for (const existingItem of existingItemsResult.recordset) {
        if (existingItem.product_id && !incomingProductIds.has(existingItem.product_id)) {
          await new sql.Request(tx)
            .input("company_id", sql.Int, companyId)
            .input("opportunity_item_id", sql.Int, existingItem.opportunity_item_id)
            .query(`DELETE FROM crm.opportunity_items WHERE company_id = @company_id AND opportunity_item_id = @opportunity_item_id;`);
        }
      }

      // Insert or update incoming items
      for (const item of items) {
        if (item.PRODUCT_ID) {
          const existingItem = existingItemsResult.recordset.find((r) => r.product_id === item.PRODUCT_ID);
          if (existingItem) {
            // Update existing
            await new sql.Request(tx)
              .input("company_id", sql.Int, companyId)
              .input("opportunity_item_id", sql.Int, existingItem.opportunity_item_id)
              .input("product_id", sql.Int, item.PRODUCT_ID)
              .input("item_description", sql.NVarChar(200), item.ITEM_DESCRIPTION || "")
              .input("quantity", sql.Decimal(12, 2), item.QUANTITY || 1)
              .input("unit_price", sql.Decimal(18, 2), item.UNIT_PRICE || 0)
              .input("discount_pct", sql.Decimal(5, 2), item.DISCOUNT_PCT || 0)
              .query(`
                UPDATE crm.opportunity_items SET
                  product_id = @product_id, item_description = @item_description,
                  quantity = @quantity, unit_price = @unit_price, discount_pct = @discount_pct
                WHERE company_id = @company_id AND opportunity_item_id = @opportunity_item_id;
              `);
          } else {
            // Insert new
            await new sql.Request(tx)
              .input("company_id", sql.Int, companyId)
              .input("opportunity_id", sql.Int, input.OPPORTUNITY_ID)
              .input("product_id", sql.Int, item.PRODUCT_ID)
              .input("item_description", sql.NVarChar(200), item.ITEM_DESCRIPTION || "")
              .input("quantity", sql.Decimal(12, 2), item.QUANTITY || 1)
              .input("unit_price", sql.Decimal(18, 2), item.UNIT_PRICE || 0)
              .input("discount_pct", sql.Decimal(5, 2), item.DISCOUNT_PCT || 0)
              .query(`
                INSERT INTO crm.opportunity_items (company_id, opportunity_id, product_id, item_description, quantity, unit_price, discount_pct)
                VALUES (@company_id, @opportunity_id, @product_id, @item_description, @quantity, @unit_price, @discount_pct);
              `);
          }
        }
      }
    }

    await tx.commit();
  } catch (error) {
    await tx.rollback();
    throw error;
  }
}

export async function advanceOpportunityStage(companyId: number, userId: number, input: OpportunityAdvanceInput) {
  const pool = await getPool();

  const existing = await pool
    .request()
    .input("company_id", sql.Int, companyId)
    .input("opportunity_id", sql.Int, input.OPPORTUNITY_ID)
    .query<{ customer_id: number; status: string; pipeline_id: number }>(`
      SELECT customer_id, status, pipeline_id FROM crm.opportunities
      WHERE company_id = @company_id AND opportunity_id = @opportunity_id;
    `);

  if (!existing.recordset[0]) throw new HttpError(404, "Oportunidad no encontrada");
  if (existing.recordset[0].status !== "abierta") throw new HttpError(400, "Solo se puede avanzar una oportunidad abierta");
  await assertCustomerInScope(companyId, userId, existing.recordset[0].customer_id);

  const stage = await pool
    .request()
    .input("company_id", sql.Int, companyId)
    .input("stage_id", sql.Int, input.STAGE_ID)
    .input("pipeline_id", sql.Int, existing.recordset[0].pipeline_id)
    .query<{ stage_id: number; probability: number; is_closed: boolean; is_won: boolean; pipeline_id: number }>(`
      SELECT stage_id, default_probability_pct AS probability, is_closed, is_won, pipeline_id
      FROM crm.pipeline_stages WHERE company_id = @company_id AND stage_id = @stage_id;
    `);

  if (!stage.recordset[0]) throw new HttpError(400, "Etapa no encontrada");
  if (stage.recordset[0].pipeline_id !== existing.recordset[0].pipeline_id) {
    throw new HttpError(400, "La etapa no pertenece al pipeline de esta oportunidad");
  }
  if (stage.recordset[0].is_closed) {
    throw new HttpError(400, "No se puede mover a una etapa cerrada");
  }

  await pool
    .request()
    .input("company_id", sql.Int, companyId)
    .input("opportunity_id", sql.Int, input.OPPORTUNITY_ID)
    .input("stage_id", sql.Int, input.STAGE_ID)
    .input("probability", sql.Decimal(5, 2), stage.recordset[0].probability)
    .query(`
      UPDATE crm.opportunities SET stage_id = @stage_id, probability_pct = @probability, updated_at = SYSUTCDATETIME()
      WHERE company_id = @company_id AND opportunity_id = @opportunity_id;
    `);
}

export async function setOpportunityStatus(companyId: number, userId: number, input: OpportunityStatusInput) {
  const pool = await getPool();

  const existing = await pool
    .request()
    .input("company_id", sql.Int, companyId)
    .input("opportunity_id", sql.Int, input.OPPORTUNITY_ID)
    .query<{ customer_id: number; status: string; pipeline_id: number }>(`
      SELECT customer_id, status, pipeline_id FROM crm.opportunities
      WHERE company_id = @company_id AND opportunity_id = @opportunity_id;
    `);

  if (!existing.recordset[0]) throw new HttpError(404, "Oportunidad no encontrada");
  if (existing.recordset[0].status !== "abierta") throw new HttpError(400, "Solo se puede cambiar status de oportunidades abiertas");
  await assertCustomerInScope(companyId, userId, existing.recordset[0].customer_id);

  const closedStage = await pool
    .request()
    .input("company_id", sql.Int, companyId)
    .input("pipeline_id", sql.Int, existing.recordset[0].pipeline_id)
    .input("is_won", sql.Bit, input.STATUS === "ganada" ? 1 : 0)
    .query<{ stage_id: number }>(`
      SELECT TOP 1 stage_id FROM crm.pipeline_stages
      WHERE company_id = @company_id AND pipeline_id = @pipeline_id AND is_closed = 1 AND is_won = @is_won;
    `);

  await pool
    .request()
    .input("company_id", sql.Int, companyId)
    .input("opportunity_id", sql.Int, input.OPPORTUNITY_ID)
    .input("status", sql.VarChar(20), input.STATUS)
    .input("stage_id", sql.Int, closedStage.recordset[0]?.stage_id || null)
    .input("lost_reason", sql.NVarChar(250), input.LOST_REASON || "")
    .input("probability", sql.Decimal(5, 2), input.STATUS === "ganada" ? 100 : 0)
    .query(`
      UPDATE crm.opportunities SET
        status = @status, stage_id = @stage_id, lost_reason = @lost_reason,
        probability_pct = @probability, updated_at = SYSUTCDATETIME()
      WHERE company_id = @company_id AND opportunity_id = @opportunity_id;
    `);
}

export async function reopenOpportunity(companyId: number, userId: number, input: { OPPORTUNITY_ID: number }) {
  const pool = await getPool();

  const existing = await pool
    .request()
    .input("company_id", sql.Int, companyId)
    .input("opportunity_id", sql.Int, input.OPPORTUNITY_ID)
    .query<{ customer_id: number; pipeline_id: number }>(`
      SELECT customer_id, pipeline_id FROM crm.opportunities
      WHERE company_id = @company_id AND opportunity_id = @opportunity_id AND status != 'abierta';
    `);

  if (!existing.recordset[0]) throw new HttpError(404, "Oportunidad no encontrada o ya esta abierta");
  await assertCustomerInScope(companyId, userId, existing.recordset[0].customer_id);

  const firstStage = await pool
    .request()
    .input("company_id", sql.Int, companyId)
    .input("pipeline_id", sql.Int, existing.recordset[0].pipeline_id)
    .query<{ stage_id: number; default_probability_pct: number }>(`
      SELECT TOP 1 stage_id, default_probability_pct FROM crm.pipeline_stages
      WHERE company_id = @company_id AND pipeline_id = @pipeline_id AND is_closed = 0
      ORDER BY stage_order ASC;
    `);

  await pool
    .request()
    .input("company_id", sql.Int, companyId)
    .input("opportunity_id", sql.Int, input.OPPORTUNITY_ID)
    .input("stage_id", sql.Int, firstStage.recordset[0]?.stage_id)
    .input("probability", sql.Decimal(5, 2), firstStage.recordset[0]?.default_probability_pct || 10)
    .query(`
      UPDATE crm.opportunities SET
        status = 'abierta', stage_id = @stage_id, lost_reason = NULL,
        probability_pct = @probability, updated_at = SYSUTCDATETIME()
      WHERE company_id = @company_id AND opportunity_id = @opportunity_id;
    `);
}

export async function getPipelines(companyId: number) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("company_id", sql.Int, companyId)
    .query(`
      SELECT ps.stage_id AS ID, ps.stage_name AS NAME, ps.stage_order AS STAGE_ORDER,
             ps.default_probability_pct AS PROBABILITY, ps.is_closed AS IS_CLOSED, ps.is_won AS IS_WON,
             ps.pipeline_id AS PIPELINE_ID, sp.pipeline_name AS PIPELINE_NAME
      FROM crm.pipeline_stages ps
      INNER JOIN crm.sales_pipelines sp ON sp.company_id = ps.company_id AND sp.pipeline_id = ps.pipeline_id
      WHERE ps.company_id = @company_id
      ORDER BY ps.pipeline_id, ps.stage_order;
    `);
  return result.recordset;
}

async function getProductPrice(companyId: number, productId: number): Promise<number> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("company_id", sql.Int, companyId)
    .input("product_id", sql.Int, productId)
    .query(`
      SELECT unit_price 
      FROM crm.products 
      WHERE company_id = @company_id AND product_id = @product_id AND is_active = 1
    `);
  
  if (!result.recordset[0]) {
    throw new HttpError(404, "Producto no encontrado o inactivo");
  }
  
  return result.recordset[0].unit_price;
}

async function assertOpportunityInScope(companyId: number, userId: number, opportunityId: number): Promise<void> {
  const pool = await getPool();
  const oppCheck = await pool
    .request()
    .input("company_id", sql.Int, companyId)
    .input("opportunity_id", sql.Int, opportunityId)
    .query<{ customer_id: number }>(`
      SELECT customer_id FROM crm.opportunities
      WHERE company_id = @company_id AND opportunity_id = @opportunity_id;
    `);

  if (!oppCheck.recordset[0]) throw new HttpError(404, "Oportunidad no encontrada");
  await assertCustomerInScope(companyId, userId, oppCheck.recordset[0].customer_id);
}

export async function createOpportunityItem(companyId: number, userId: number, opportunityId: number, input: OpportunityItemInput) {
  await assertOpportunityInScope(companyId, userId, opportunityId);
  const pool = await getPool();
  
  let unitPrice = input.UNIT_PRICE || 0;
  if (input.PRODUCT_ID) {
    unitPrice = await getProductPrice(companyId, input.PRODUCT_ID);
  }
  
  const result = await pool
    .request()
    .input("company_id", sql.Int, companyId)
    .input("opportunity_id", sql.Int, opportunityId)
    .input("product_id", sql.Int, input.PRODUCT_ID ?? null)
    .input("item_description", sql.NVarChar(200), input.ITEM_DESCRIPTION || "")
    .input("quantity", sql.Decimal(12, 2), input.QUANTITY || 1)
    .input("unit_price", sql.Decimal(18, 2), unitPrice)
    .input("discount_pct", sql.Decimal(5, 2), input.DISCOUNT_PCT || 0)
    .query(`
      INSERT INTO crm.opportunity_items (company_id, opportunity_id, product_id, item_description, quantity, unit_price, discount_pct)
      OUTPUT INSERTED.opportunity_item_id
      VALUES (@company_id, @opportunity_id, @product_id, @item_description, @quantity, @unit_price, @discount_pct);
    `);
  
  return result.recordset[0].opportunity_item_id;
}

export async function updateOpportunityItem(companyId: number, userId: number, opportunityId: number, itemId: number, input: OpportunityItemInput) {
  await assertOpportunityInScope(companyId, userId, opportunityId);
  const pool = await getPool();
  
  let unitPrice = 0;
  if (input.PRODUCT_ID) {
    unitPrice = await getProductPrice(companyId, input.PRODUCT_ID);
  }
  
  await pool
    .request()
    .input("company_id", sql.Int, companyId)
    .input("opportunity_id", sql.Int, opportunityId)
    .input("opportunity_item_id", sql.Int, itemId)
    .input("product_id", sql.Int, input.PRODUCT_ID ?? null)
    .input("item_description", sql.NVarChar(200), input.ITEM_DESCRIPTION || "")
    .input("quantity", sql.Decimal(12, 2), input.QUANTITY || 1)
    .input("unit_price", sql.Decimal(18, 2), unitPrice)
    .input("discount_pct", sql.Decimal(5, 2), input.DISCOUNT_PCT || 0)
    .query(`
      UPDATE crm.opportunity_items 
      SET product_id = @product_id,
          item_description = @item_description,
          quantity = @quantity,
          unit_price = @unit_price,
          discount_pct = @discount_pct
      WHERE company_id = @company_id 
        AND opportunity_id = @opportunity_id 
        AND opportunity_item_id = @opportunity_item_id;
    `);
}

export async function deleteOpportunityItem(companyId: number, userId: number, opportunityId: number, itemId: number) {
  await assertOpportunityInScope(companyId, userId, opportunityId);
  const pool = await getPool();
  
  await pool
    .request()
    .input("company_id", sql.Int, companyId)
    .input("opportunity_id", sql.Int, opportunityId)
    .input("opportunity_item_id", sql.Int, itemId)
    .query(`
      DELETE FROM crm.opportunity_items 
      WHERE company_id = @company_id 
        AND opportunity_id = @opportunity_id 
        AND opportunity_item_id = @opportunity_item_id;
    `);
}

export async function getOpportunitiesByCustomer(companyId: number, userId: number, customerId: number) {
  await assertCustomerInScope(companyId, userId, customerId);
  const pool = await getPool();
  const result = await pool
    .request()
    .input("company_id", sql.Int, companyId)
    .input("customer_id", sql.Int, customerId)
    .query(`
      SELECT o.opportunity_id AS OPPORTUNITYID, o.title AS TITLE, o.amount AS AMOUNT,
             ps.stage_name AS STAGE_NAME, ps.stage_order AS STAGE_ORDER,
             o.probability_pct AS PROBABILITY, o.status AS STATUS, o.close_date AS CLOSE_DATE
      FROM crm.opportunities o
      LEFT JOIN crm.pipeline_stages ps ON ps.stage_id = o.stage_id
      WHERE o.company_id = @company_id AND o.customer_id = @customer_id
      ORDER BY o.status ASC, ps.stage_order DESC, o.created_at DESC;
    `);
  return result.recordset;
}

export async function deleteOpportunity(companyId: number, userId: number, opportunityId: number) {
  const pool = await getPool();

  const existing = await pool
    .request()
    .input("company_id", sql.Int, companyId)
    .input("opportunity_id", sql.Int, opportunityId)
    .query<{ customer_id: number }>(`
      SELECT customer_id FROM crm.opportunities
      WHERE company_id = @company_id AND opportunity_id = @opportunity_id;
    `);

  if (!existing.recordset[0]) throw new HttpError(404, "Oportunidad no encontrada");
  await assertCustomerInScope(companyId, userId, existing.recordset[0].customer_id);

  const tx = new sql.Transaction(pool);
  await tx.begin();

  try {
    await new sql.Request(tx)
      .input("company_id", sql.Int, companyId)
      .input("opportunity_id", sql.Int, opportunityId)
      .query(`DELETE FROM crm.opportunity_items WHERE company_id = @company_id AND opportunity_id = @opportunity_id;`);

    await new sql.Request(tx)
      .input("company_id", sql.Int, companyId)
      .input("opportunity_id", sql.Int, opportunityId)
      .query(`DELETE FROM crm.opportunities WHERE company_id = @company_id AND opportunity_id = @opportunity_id;`);

    await tx.commit();
  } catch (error) {
    await tx.rollback();
    throw error;
  }
}
