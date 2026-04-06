-- Agregar SUCURSALID a la vista vw_cn_clientes
-- Esto permite filtrar clientes por ID de sucursal en vez de nombre

ALTER VIEW [api].[vw_cn_clientes]
AS
SELECT
    c.company_id,
    c.customer_id,
    c.customer_code AS CLIENTEID,
    c.customer_name AS NOMBRECLI,
    c.business_line AS GIRO,
    c.street AS CALLE,
    c.ext_number AS NUM_EXT,
    c.neighborhood AS COLONIA,
    c.city AS CIUDAD,
    c.state AS ESTADO,
    c.email AS EMAIL,
    c.phone AS TEL,
    c.status AS ESTATUS,
    b.branch_id AS SUCURSALID,
    b.branch_name AS SUCURSAL,
    r.vendedor_id AS VENDEDORID,
    r.vendedor_name AS VENDEDOR,
    c.latitude AS LAT,
    c.longitude AS LON,
    c.net_sales_3m AS VENTA_NETA,
    c.margin_pct AS MARGEN,
    c.credit_line AS LINEA_CREDITO,
    c.exercised_amount AS MONTO_EJERCIDO,
    c.overdue_amount AS CARTERA_VENCIDA,
    c.avg_overdue_days AS PROMEDIO_DIAS_VENCIDOS,
    CASE WHEN c.inactive_cv = 1 THEN 'SI' ELSE 'NO' END AS INACTIVOCV,
    CASE WHEN c.order_hold = 1 THEN 'SI' ELSE 'NO' END AS RETENCION_PEDIDOS,
    c.hold_reason AS RAZON_RETENCION,
    c.insurance_status AS ASEGURANZA,
    c.customer_type AS TIPO
FROM crm.customers c
LEFT JOIN crm.branches b
  ON b.company_id = c.company_id AND b.branch_id = c.branch_id
LEFT JOIN crm.vendedores r
  ON r.company_id = c.company_id AND r.vendedor_id = c.route_id;
GO
