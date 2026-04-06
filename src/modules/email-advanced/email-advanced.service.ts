import { getPool, sql } from "../../db/sqlserver";
import { HttpError } from "../../shared/http-error";

export async function getEmailTemplates(userId: number, companyId: number) {
  const pool = await getPool();
  const result = await pool.request()
    .input("user_id", sql.Int, userId)
    .input("company_id", sql.Int, companyId)
    .query(`
      SELECT id, user_id, company_id, name, subject, body, variables, is_system, created_at, updated_at
        FROM crm.email_templates
       WHERE company_id = @company_id AND (user_id = @user_id OR user_id IS NULL)
       ORDER BY is_system DESC, name ASC
    `);

  return result.recordset;
}

export async function createEmailTemplate(userId: number, companyId: number, data: { name: string; subject: string; body: string; variables?: string | null }) {
  const pool = await getPool();
  const result = await pool.request()
    .input("user_id", sql.Int, userId)
    .input("company_id", sql.Int, companyId)
    .input("name", sql.NVarChar(255), data.name)
    .input("subject", sql.NVarChar(500), data.subject)
    .input("body", sql.NVarChar(sql.MAX), data.body)
    .input("variables", sql.NVarChar(1000), data.variables || null)
    .query(`
      INSERT INTO crm.email_templates (user_id, company_id, name, subject, body, variables)
      OUTPUT INSERTED.id
      VALUES (@user_id, @company_id, @name, @subject, @body, @variables)
    `);

  return result.recordset[0]?.id;
}

export async function updateEmailTemplate(userId: number, companyId: number, templateId: number, data: { name: string; subject: string; body: string; variables?: string | null }) {
  const pool = await getPool();
  const existing = await pool.request()
    .input("id", sql.Int, templateId)
    .query(`SELECT id, is_system FROM crm.email_templates WHERE id = @id AND company_id = @company_id`, { company_id: sql.Int, value: companyId });

  if (!existing.recordset[0]) {
    throw new HttpError(404, "Plantilla no encontrada");
  }

  if (existing.recordset[0].is_system) {
    throw new HttpError(400, "No se pueden editar plantillas del sistema");
  }

  await pool.request()
    .input("id", sql.Int, templateId)
    .input("name", sql.NVarChar(255), data.name)
    .input("subject", sql.NVarChar(500), data.subject)
    .input("body", sql.NVarChar(sql.MAX), data.body)
    .input("variables", sql.NVarChar(1000), data.variables || null)
    .query(`UPDATE crm.email_templates SET name = @name, subject = @subject, body = @body, variables = @variables, updated_at = SYSUTCDATETIME() WHERE id = @id`);
}

export async function deleteEmailTemplate(userId: number, companyId: number, templateId: number) {
  const pool = await getPool();
  const existing = await pool.request()
    .input("id", sql.Int, templateId)
    .query(`SELECT id, is_system FROM crm.email_templates WHERE id = @id AND company_id = @company_id`, { company_id: sql.Int, value: companyId });

  if (!existing.recordset[0]) {
    throw new HttpError(404, "Plantilla no encontrada");
  }

  if (existing.recordset[0].is_system) {
    throw new HttpError(400, "No se pueden eliminar plantillas del sistema");
  }

  await pool.request()
    .input("id", sql.Int, templateId)
    .query(`DELETE FROM crm.email_templates WHERE id = @id`);
}

export async function getTemplateById(templateId: number) {
  const pool = await getPool();
  const result = await pool.request()
    .input("id", sql.Int, templateId)
    .query(`SELECT id, name, subject, body, variables FROM crm.email_templates WHERE id = @id`);

  return result.recordset[0] || null;
}

export function applyTemplateVariables(template: string, variables: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`{{${key}}}`, "g"), value);
  }
  return result;
}

export async function trackEmailOpen(emailSentId: number): Promise<void> {
  const pool = await getPool();
  const existing = await pool.request()
    .input("email_sent_id", sql.Int, emailSentId)
    .query(`SELECT id, open_count FROM crm.email_tracking WHERE email_sent_id = @email_sent_id`);

  if (existing.recordset.length > 0) {
    await pool.request()
      .input("email_sent_id", sql.Int, emailSentId)
      .query(`UPDATE crm.email_tracking SET opened = 1, open_count = open_count + 1, opened_at = SYSUTCDATETIME(), last_clicked_at = ISNULL(last_clicked_at, SYSUTCDATETIME()) WHERE email_sent_id = @email_sent_id`);
  } else {
    await pool.request()
      .input("email_sent_id", sql.Int, emailSentId)
      .query(`INSERT INTO crm.email_tracking (email_sent_id, opened, open_count, opened_at) VALUES (@email_sent_id, 1, 1, SYSUTCDATETIME())`);
  }
}

export async function trackEmailClick(emailSentId: number, link: string): Promise<void> {
  const pool = await getPool();
  const existing = await pool.request()
    .input("email_sent_id", sql.Int, emailSentId)
    .query(`SELECT id, links_clicked FROM crm.email_tracking WHERE email_sent_id = @email_sent_id`);

  if (existing.recordset.length > 0) {
    const currentLinks = existing.recordset[0].links_clicked || "[]";
    let links: string[] = [];
    try { links = JSON.parse(currentLinks); } catch { links = []; }
    links.push(link);

    await pool.request()
      .input("email_sent_id", sql.Int, emailSentId)
      .input("links_clicked", sql.NVarChar(sql.MAX), JSON.stringify(links))
      .query(`UPDATE crm.email_tracking SET links_clicked = @links_clicked, last_clicked_at = SYSUTCDATETIME() WHERE email_sent_id = @email_sent_id`);
  } else {
    await pool.request()
      .input("email_sent_id", sql.Int, emailSentId)
      .input("links_clicked", sql.NVarChar(sql.MAX), JSON.stringify([link]))
      .query(`INSERT INTO crm.email_tracking (email_sent_id, links_clicked, last_clicked_at) VALUES (@email_sent_id, @links_clicked, SYSUTCDATETIME())`);
  }
}

export async function getUserSignature(userId: number) {
  const pool = await getPool();
  const result = await pool.request()
    .input("user_id", sql.Int, userId)
    .query(`SELECT id, signature_html, is_default FROM sec.user_signatures WHERE user_id = @user_id ORDER BY is_default DESC, created_at DESC OFFSET 0 ROWS FETCH NEXT 1 ROWS ONLY`);

  return result.recordset[0] || null;
}

export async function saveUserSignature(userId: number, signatureHtml: string, isDefault = true) {
  const pool = await getPool();
  await pool.request()
    .input("user_id", sql.Int, userId)
    .input("signature_html", sql.NVarChar(sql.MAX), signatureHtml)
    .input("is_default", sql.Bit, isDefault ? 1 : 0)
    .query(`
      MERGE sec.user_signatures AS target
      USING (SELECT @user_id AS user_id) AS source
      ON target.user_id = source.user_id
      WHEN MATCHED THEN UPDATE SET signature_html = @signature_html, is_default = @is_default, updated_at = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN INSERT (user_id, signature_html, is_default) VALUES (@user_id, @signature_html, @is_default);
    `);
}

export async function getEmailTrackingStats(userId: number, companyId: number) {
  const pool = await getPool();
  const result = await pool.request()
    .input("user_id", sql.Int, userId)
    .input("company_id", sql.Int, companyId)
    .query(`
      SELECT
        COUNT(*) AS total_sent,
        SUM(CASE WHEN t.opened = 1 THEN 1 ELSE 0 END) AS total_opened,
        SUM(CASE WHEN t.links_clicked IS NOT NULL THEN 1 ELSE 0 END) AS total_clicked,
        SUM(CASE WHEN t.opened = 1 THEN t.open_count ELSE 0 END) AS total_opens
      FROM crm.email_sent e
      LEFT JOIN crm.email_tracking t ON t.email_sent_id = e.id
      WHERE e.user_id = @user_id AND e.company_id = @company_id
    `);

  return result.recordset[0] || { total_sent: 0, total_opened: 0, total_clicked: 0, total_opens: 0 };
}
