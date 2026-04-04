import { getPool, sql } from "../../db/sqlserver";
import { ProductsAbcInput, ProductsListInput, ProductCategoriesInput } from "./products.schemas";
import { HttpError } from "../../shared/http-error";

export async function listProducts(companyId: number, input: ProductsListInput) {
  const pool = await getPool();
  const page = Math.max(1, input.NPAG || 1);
  const pageSize = input.TPAG && input.TPAG > 0 ? input.TPAG : 20;
  const offset = (page - 1) * pageSize;

  const whereSearch = input.SEARCH ? "AND (p.product_name LIKE @search OR p.sku LIKE @search)" : "";
  const whereStatus = input.STATUS === "active" ? "AND p.is_active = 1" : input.STATUS === "inactive" ? "AND p.is_active = 0" : "";
  const whereCategory = input.CATEGORY_ID ? "AND p.category_id = @category_id" : "";

  const sortBy = input.SORT_BY === "sku" ? "p.sku"
    : input.SORT_BY === "unit_price" ? "p.unit_price"
    : "p.product_name";
  const sortDir = input.SORT_DIR === "DESC" ? "DESC" : "ASC";

  const countResult = await pool
    .request()
    .input("company_id", sql.Int, companyId)
    .input("search", sql.NVarChar(200), input.SEARCH ? `%${input.SEARCH}%` : "")
    .input("category_id", sql.Int, input.CATEGORY_ID ?? null)
    .query<{ total: number }>(`
      SELECT COUNT(1) AS total FROM crm.products p
      WHERE p.company_id = @company_id ${whereSearch} ${whereStatus} ${whereCategory};
    `);

  const total = countResult.recordset[0]?.total ?? 0;
  const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(total / pageSize)) : 1;

  const dataResult = await pool
    .request()
    .input("company_id", sql.Int, companyId)
    .input("search", sql.NVarChar(200), input.SEARCH ? `%${input.SEARCH}%` : "")
    .input("category_id", sql.Int, input.CATEGORY_ID ?? null)
    .input("offset", sql.Int, offset)
    .input("page_size", sql.Int, pageSize)
    .query(`
      SELECT p.product_id AS ID, p.sku AS SKU, p.product_name AS NAME,
             p.description AS DESCRIPTION, p.unit_price AS UNIT_PRICE,
             p.is_active AS IS_ACTIVE, p.category_id AS CATEGORY_ID,
             pc.category_name AS CATEGORY_NAME,
             p.created_at AS CREATED_AT, p.updated_at AS UPDATED_AT
      FROM crm.products p
      LEFT JOIN crm.product_categories pc ON pc.category_id = p.category_id
      WHERE p.company_id = @company_id ${whereSearch} ${whereStatus} ${whereCategory}
      ORDER BY ${sortBy} ${sortDir}
      OFFSET @offset ROWS FETCH NEXT @page_size ROWS ONLY;
    `);

  return { data: dataResult.recordset, tot_pags: totalPages, total_regs: total };
}

export async function getProductCategories(companyId: number) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("company_id", sql.Int, companyId)
    .query(`
      SELECT category_id AS ID, category_name AS NAME, description AS DESCRIPTION, is_active AS IS_ACTIVE
      FROM crm.product_categories
      WHERE company_id = @company_id AND is_active = 1
      ORDER BY category_name;
    `);
  return result.recordset;
}

export async function productCategoriesAbc(companyId: number, input: ProductCategoriesInput): Promise<string> {
  const pool = await getPool();

  if (input.TIPO === "A") {
    await pool
      .request()
      .input("company_id", sql.Int, companyId)
      .input("category_name", sql.NVarChar(100), input.CATEGORY_NAME)
      .input("description", sql.NVarChar(500), input.DESCRIPTION || "")
      .query(`
        INSERT INTO crm.product_categories (company_id, category_name, description, is_active)
        VALUES (@company_id, @category_name, @description, 1);
      `);
    return "Categoría creada correctamente";
  }

  if (input.TIPO === "C") {
    await pool
      .request()
      .input("category_id", sql.Int, input.CATEGORY_ID)
      .input("category_name", sql.NVarChar(100), input.CATEGORY_NAME)
      .input("description", sql.NVarChar(500), input.DESCRIPTION || "")
      .query(`
        UPDATE crm.product_categories SET category_name = @category_name, description = @description
        WHERE category_id = @category_id;
      `);
    return "Categoría actualizada correctamente";
  }

  if (input.TIPO === "B") {
    await pool
      .request()
      .input("category_id", sql.Int, input.CATEGORY_ID)
      .query(`
        UPDATE crm.product_categories SET is_active = 0 WHERE category_id = @category_id;
      `);
    return "Categoría eliminada correctamente";
  }

  throw new Error("Tipo de operacion no valido");
}

export async function getProductPriceHistory(companyId: number, productId: number) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("company_id", sql.Int, companyId)
    .input("product_id", sql.Int, productId)
    .query(`
      SELECT old_price, new_price, changed_by_user_id, changed_at
      FROM crm.product_price_history
      WHERE company_id = @company_id AND product_id = @product_id
      ORDER BY changed_at DESC;
    `);
  return result.recordset;
}

export async function productsAbc(companyId: number, userId: number, input: ProductsAbcInput): Promise<string> {
  const pool = await getPool();

  if (input.TIPO === "A") {
    // Check for duplicate SKU
    if (input.SKU) {
      const existing = await pool
        .request()
        .input("company_id", sql.Int, companyId)
        .input("sku", sql.VarChar(40), input.SKU)
        .query(`SELECT 1 FROM crm.products WHERE company_id = @company_id AND sku = @sku;`);

      if (existing.recordset[0]) {
        throw new HttpError(400, "Ya existe un producto con ese SKU");
      }
    }

    await pool
      .request()
      .input("company_id", sql.Int, companyId)
      .input("sku", sql.VarChar(40), input.SKU || "")
      .input("product_name", sql.NVarChar(180), input.PRODUCT_NAME)
      .input("description", sql.NVarChar(500), input.DESCRIPTION || "")
      .input("unit_price", sql.Decimal(18, 2), input.UNIT_PRICE || 0)
      .input("category_id", sql.Int, input.CATEGORY_ID ?? null)
      .query(`
        INSERT INTO crm.products (company_id, sku, product_name, description, unit_price, is_active, category_id)
        VALUES (@company_id, @sku, @product_name, @description, @unit_price, 1, @category_id);
      `);
    return "Producto creado correctamente";
  }

  if (input.TIPO === "C") {
    // Check for duplicate SKU (excluding current product)
    if (input.SKU && input.PRODUCT_ID) {
      const existing = await pool
        .request()
        .input("company_id", sql.Int, companyId)
        .input("sku", sql.VarChar(40), input.SKU)
        .input("product_id", sql.Int, input.PRODUCT_ID)
        .query(`SELECT 1 FROM crm.products WHERE company_id = @company_id AND sku = @sku AND product_id != @product_id;`);

      if (existing.recordset[0]) {
        throw new HttpError(400, "Ya existe un producto con ese SKU");
      }
    }

    // Get old price for history
    const oldPriceResult = await pool
      .request()
      .input("company_id", sql.Int, companyId)
      .input("product_id", sql.Int, input.PRODUCT_ID)
      .query<{ unit_price: number }>(`
        SELECT unit_price FROM crm.products WHERE company_id = @company_id AND product_id = @product_id;
      `);

    const oldPrice = oldPriceResult.recordset[0]?.unit_price;

    await pool
      .request()
      .input("company_id", sql.Int, companyId)
      .input("product_id", sql.Int, input.PRODUCT_ID)
      .input("sku", sql.VarChar(40), input.SKU || "")
      .input("product_name", sql.NVarChar(180), input.PRODUCT_NAME)
      .input("description", sql.NVarChar(500), input.DESCRIPTION || "")
      .input("unit_price", sql.Decimal(18, 2), input.UNIT_PRICE || 0)
      .input("category_id", sql.Int, input.CATEGORY_ID ?? null)
      .query(`
        UPDATE crm.products SET sku=@sku, product_name=@product_name, description=@description,
          unit_price=@unit_price, category_id=@category_id, updated_at=SYSUTCDATETIME()
        WHERE company_id=@company_id AND product_id=@product_id;
      `);

    // Record price change if price changed
    if (oldPrice !== undefined && oldPrice !== input.UNIT_PRICE) {
      await pool
        .request()
        .input("company_id", sql.Int, companyId)
        .input("product_id", sql.Int, input.PRODUCT_ID)
        .input("old_price", sql.Decimal(18, 2), oldPrice)
        .input("new_price", sql.Decimal(18, 2), input.UNIT_PRICE || 0)
        .input("changed_by_user_id", sql.Int, userId)
        .query(`
          INSERT INTO crm.product_price_history (company_id, product_id, old_price, new_price, changed_by_user_id)
          VALUES (@company_id, @product_id, @old_price, @new_price, @changed_by_user_id);
        `);
    }

    return "Producto actualizado correctamente";
  }

  if (input.TIPO === "B") {
    // Check if product is used in opportunities
    const inUse = await pool
      .request()
      .input("company_id", sql.Int, companyId)
      .input("product_id", sql.Int, input.PRODUCT_ID)
      .query<{ cnt: number }>(`
        SELECT COUNT(1) AS cnt FROM crm.opportunity_items oi
        INNER JOIN crm.opportunities o ON o.company_id = oi.company_id AND o.opportunity_id = oi.opportunity_id
        WHERE oi.company_id = @company_id AND oi.product_id = @product_id AND o.status = 'abierta';
      `);

    if (inUse.recordset[0]?.cnt > 0) {
      throw new HttpError(400, "No se puede eliminar: el producto está en uso en oportunidades abiertas");
    }

    await pool
      .request()
      .input("company_id", sql.Int, companyId)
      .input("product_id", sql.Int, input.PRODUCT_ID)
      .query(`
        UPDATE crm.products SET is_active = 0, updated_at = SYSUTCDATETIME()
        WHERE company_id = @company_id AND product_id = @product_id;
      `);
    return "Producto eliminado correctamente";
  }

  throw new Error("Tipo de operacion no valido");
}
