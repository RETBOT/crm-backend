import { getPool, sql } from "../../db/sqlserver";
import { ProductsAbcInput } from "./products.schemas";

export async function listProducts(companyId: number) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("company_id", sql.Int, companyId)
    .query(`
      SELECT product_id AS ID, sku AS SKU, product_name AS NAME,
             description AS DESCRIPTION, unit_price AS UNIT_PRICE, is_active AS IS_ACTIVE
      FROM crm.products WHERE company_id = @company_id AND is_active = 1
      ORDER BY product_name;
    `);
  return result.recordset;
}

export async function productsAbc(companyId: number, input: ProductsAbcInput): Promise<string> {
  const pool = await getPool();

  if (input.TIPO === "A") {
    await pool
      .request()
      .input("company_id", sql.Int, companyId)
      .input("sku", sql.VarChar(40), input.SKU || "")
      .input("product_name", sql.NVarChar(180), input.PRODUCT_NAME)
      .input("description", sql.NVarChar(500), input.DESCRIPTION || "")
      .input("unit_price", sql.Decimal(18, 2), input.UNIT_PRICE || 0)
      .query(`
        INSERT INTO crm.products (company_id, sku, product_name, description, unit_price, is_active)
        VALUES (@company_id, @sku, @product_name, @description, @unit_price, 1);
      `);
    return "Producto creado correctamente";
  }

  if (input.TIPO === "C") {
    await pool
      .request()
      .input("company_id", sql.Int, companyId)
      .input("product_id", sql.Int, input.PRODUCT_ID)
      .input("sku", sql.VarChar(40), input.SKU || "")
      .input("product_name", sql.NVarChar(180), input.PRODUCT_NAME)
      .input("description", sql.NVarChar(500), input.DESCRIPTION || "")
      .input("unit_price", sql.Decimal(18, 2), input.UNIT_PRICE || 0)
      .query(`
        UPDATE crm.products SET sku=@sku, product_name=@product_name, description=@description,
          unit_price=@unit_price, updated_at=SYSUTCDATETIME()
        WHERE company_id=@company_id AND product_id=@product_id;
      `);
    return "Producto actualizado correctamente";
  }

  if (input.TIPO === "B") {
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
