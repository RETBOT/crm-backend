import { google } from "googleapis";
import { Client } from "@microsoft/microsoft-graph-client";
import { env } from "../../config/env";
import { getPool, sql } from "../../db/sqlserver";
import { HttpError } from "../../shared/http-error";
import { getUserEmailAccount } from "../email/email.service";

type EmailAccount = {
  id: number;
  user_id: number;
  provider: string;
  email: string;
  access_token: string;
  refresh_token: string | null;
  token_expires_at: Date | null;
  is_default: boolean;
  is_active: boolean;
};

async function getValidToken(account: EmailAccount): Promise<string> {
  const now = new Date();
  if (account.token_expires_at && account.token_expires_at > new Date(now.getTime() + 5 * 60 * 1000)) {
    return account.access_token;
  }

  if (account.provider === "google") {
    return refreshGoogleToken(account);
  }

  if (account.provider === "microsoft") {
    return refreshMicrosoftToken(account);
  }

  throw new HttpError(400, "Proveedor no soportado");
}

async function refreshGoogleToken(account: EmailAccount): Promise<string> {
  const oauth2Client = new google.auth.OAuth2(
    env.oauth.googleClientId,
    env.oauth.googleClientSecret,
    `${env.appUrl}/email/callback/google`
  );

  oauth2Client.setCredentials({ refresh_token: account.refresh_token });
  const { credentials } = await oauth2Client.refreshAccessToken();
  const newAccessToken = credentials.access_token as string;
  const expiresAt = credentials.expiry_date ? new Date(credentials.expiry_date) : null;

  const pool = await getPool();
  await pool.request()
    .input("id", sql.Int, account.id)
    .input("access_token", sql.NVarChar(sql.MAX), newAccessToken)
    .input("token_expires_at", sql.DateTime2, expiresAt)
    .query(`UPDATE sec.user_email_accounts SET access_token = @access_token, token_expires_at = @token_expires_at, updated_at = SYSUTCDATETIME() WHERE id = @id`);

  return newAccessToken;
}

async function refreshMicrosoftToken(account: EmailAccount): Promise<string> {
  const { ConfidentialClientApplication } = await import("@azure/msal-node");
  const msalConfig = {
    auth: {
      clientId: env.oauth.microsoftClientId,
      clientSecret: env.oauth.microsoftClientSecret,
      authority: `https://login.microsoftonline.com/${env.oauth.microsoftTenant}`,
    },
  };

  const cca = new ConfidentialClientApplication(msalConfig);
  const result = await cca.acquireTokenByRefreshToken({
    refreshToken: account.refresh_token!,
    scopes: ["https://graph.microsoft.com/Calendars.Read", "https://graph.microsoft.com/Calendars.ReadWrite", "https://graph.microsoft.com/User.Read"],
  });

  if (!result?.accessToken) {
    throw new HttpError(500, "No se pudo renovar el token de Microsoft");
  }

  const expiresAt = result.expiresOn ? new Date(result.expiresOn) : null;
  const pool = await getPool();
  await pool.request()
    .input("id", sql.Int, account.id)
    .input("access_token", sql.NVarChar(sql.MAX), result.accessToken)
    .input("token_expires_at", sql.DateTime2, expiresAt)
    .query(`UPDATE sec.user_email_accounts SET access_token = @access_token, token_expires_at = @token_expires_at, updated_at = SYSUTCDATETIME() WHERE id = @id`);

  return result.accessToken;
}

export async function syncGoogleCalendar(userId: number): Promise<{ count: number }> {
  const account = await getUserEmailAccount(userId, "google");
  if (!account) {
    throw new HttpError(400, "No tienes una cuenta de Google conectada");
  }

  const accessToken = await getValidToken(account);
  const oauth2Client = new google.auth.OAuth2(env.oauth.googleClientId, env.oauth.googleClientSecret);
  oauth2Client.setCredentials({ access_token: accessToken });

  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  const pool = await getPool();
  const syncConfig = await pool.request()
    .input("user_id", sql.Int, userId)
    .input("provider", sql.VarChar(20), "google")
    .query<{ sync_token: string | null; page_token: string | null }>(`
      SELECT sync_token, page_token FROM crm.calendar_sync WHERE user_id = @user_id AND provider = @provider
    `);

  let events;
  if (syncConfig.recordset[0]?.sync_token) {
    const res = await calendar.events.list({
      calendarId: "primary",
      syncToken: syncConfig.recordset[0].sync_token,
      maxResults: 2500,
    });

    if (res.status === 410) {
      const fullRes = await calendar.events.list({ calendarId: "primary", maxResults: 2500 });
      events = fullRes.data.items || [];
      const newSyncToken = fullRes.data.nextSyncToken || "";
      await pool.request()
        .input("user_id", sql.Int, userId)
        .input("provider", sql.VarChar(20), "google")
        .input("sync_token", sql.NVarChar(sql.MAX), newSyncToken)
        .query(`
          MERGE crm.calendar_sync AS target
          USING (SELECT @user_id AS user_id, @provider AS provider) AS source
          ON target.user_id = source.user_id AND target.provider = source.provider
          WHEN MATCHED THEN UPDATE SET sync_token = @sync_token, last_sync = SYSUTCDATETIME(), updated_at = SYSUTCDATETIME()
          WHEN NOT MATCHED THEN INSERT (user_id, provider, sync_token, last_sync) VALUES (@user_id, @provider, @sync_token, SYSUTCDATETIME());
        `);
    } else {
      events = res.data.items || [];
      const newSyncToken = res.data.nextSyncToken || syncConfig.recordset[0].sync_token;
      await pool.request()
        .input("user_id", sql.Int, userId)
        .input("provider", sql.VarChar(20), "google")
        .input("sync_token", sql.NVarChar(sql.MAX), newSyncToken)
        .query(`
          MERGE crm.calendar_sync AS target
          USING (SELECT @user_id AS user_id, @provider AS provider) AS source
          ON target.user_id = source.user_id AND target.provider = source.provider
          WHEN MATCHED THEN UPDATE SET sync_token = @sync_token, last_sync = SYSUTCDATETIME(), updated_at = SYSUTCDATETIME()
          WHEN NOT MATCHED THEN INSERT (user_id, provider, sync_token, last_sync) VALUES (@user_id, @provider, @sync_token, SYSUTCDATETIME());
        `);
    }
  } else {
    const res = await calendar.events.list({ calendarId: "primary", maxResults: 2500 });
    events = res.data.items || [];
    const newSyncToken = res.data.nextSyncToken || "";
    await pool.request()
      .input("user_id", sql.Int, userId)
      .input("provider", sql.VarChar(20), "google")
      .input("sync_token", sql.NVarChar(sql.MAX), newSyncToken)
      .query(`
        MERGE crm.calendar_sync AS target
        USING (SELECT @user_id AS user_id, @provider AS provider) AS source
        ON target.user_id = source.user_id AND target.provider = source.provider
        WHEN MATCHED THEN UPDATE SET sync_token = @sync_token, last_sync = SYSUTCDATETIME(), updated_at = SYSUTCDATETIME()
        WHEN NOT MATCHED THEN INSERT (user_id, provider, sync_token, last_sync) VALUES (@user_id, @provider, @sync_token, SYSUTCDATETIME());
      `);
  }

  let count = 0;
  for (const event of events) {
    if (!event.id || event.status === "cancelled") continue;

    const startStr = event.start?.dateTime || event.start?.date;
    const endStr = event.end?.dateTime || event.end?.date;
    if (!startStr || !endStr) continue;

    const startTime = new Date(startStr);
    const endTime = new Date(endStr);
    const isAllDay = !event.start?.dateTime;

    await pool.request()
      .input("user_id", sql.Int, userId)
      .input("provider", sql.VarChar(20), "google")
      .input("external_id", sql.NVarChar(500), event.id)
      .input("title", sql.NVarChar(500), event.summary || "Sin título")
      .input("description", sql.NVarChar(sql.MAX), event.description || null)
      .input("start_time", sql.DateTime2, startTime)
      .input("end_time", sql.DateTime2, endTime)
      .input("location", sql.NVarChar(500), event.location || null)
      .input("is_all_day", sql.Bit, isAllDay ? 1 : 0)
      .query(`
        MERGE crm.external_events AS target
        USING (SELECT @user_id AS user_id, @provider AS provider, @external_id AS external_id) AS source
        ON target.user_id = source.user_id AND target.provider = source.provider AND target.external_id = source.external_id
        WHEN MATCHED THEN UPDATE SET title = @title, description = @description, start_time = @start_time, end_time = @end_time, location = @location, is_all_day = @is_all_day, updated_at = SYSUTCDATETIME()
        WHEN NOT MATCHED THEN INSERT (user_id, provider, external_id, title, description, start_time, end_time, location, is_all_day) VALUES (@user_id, @provider, @external_id, @title, @description, @start_time, @end_time, @location, @is_all_day);
      `);

    count++;
  }

  return { count };
}

export async function syncMicrosoftCalendar(userId: number): Promise<{ count: number }> {
  const account = await getUserEmailAccount(userId, "microsoft");
  if (!account) {
    throw new HttpError(400, "No tienes una cuenta de Microsoft conectada");
  }

  const accessToken = await getValidToken(account);
  const client = Client.init({ authProvider: (done) => { done(null, accessToken); } });

  const pool = await getPool();
  let deltaLink = await pool.request()
    .input("user_id", sql.Int, userId)
    .input("provider", sql.VarChar(20), "microsoft")
    .query<{ page_token: string | null }>(`
      SELECT page_token FROM crm.calendar_sync WHERE user_id = @user_id AND provider = @microsoft
    `);

  let events: any[] = [];
  try {
    if (deltaLink.recordset[0]?.page_token) {
      const result: any = await client.api(deltaLink.recordset[0].page_token).get();
      events = result.value || [];
      if (result["@odata.deltaLink"]) {
        await pool.request()
          .input("user_id", sql.Int, userId)
          .input("provider", sql.VarChar(20), "microsoft")
          .input("page_token", sql.NVarChar(sql.MAX), result["@odata.deltaLink"])
          .query(`
            MERGE crm.calendar_sync AS target
            USING (SELECT @user_id AS user_id, @provider AS provider) AS source
            ON target.user_id = source.user_id AND target.provider = source.provider
            WHEN MATCHED THEN UPDATE SET page_token = @page_token, last_sync = SYSUTCDATETIME(), updated_at = SYSUTCDATETIME()
            WHEN NOT MATCHED THEN INSERT (user_id, provider, page_token, last_sync) VALUES (@user_id, @provider, @page_token, SYSUTCDATETIME());
          `);
      }
    } else {
      const result: any = await client.api("/me/calendarView/delta")
        .query({ startDateTime: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), endDateTime: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString() })
        .get();
      events = result.value || [];
      if (result["@odata.deltaLink"]) {
        await pool.request()
          .input("user_id", sql.Int, userId)
          .input("provider", sql.VarChar(20), "microsoft")
          .input("page_token", sql.NVarChar(sql.MAX), result["@odata.deltaLink"])
          .query(`
            MERGE crm.calendar_sync AS target
            USING (SELECT @user_id AS user_id, @provider AS provider) AS source
            ON target.user_id = source.user_id AND target.provider = source.provider
            WHEN MATCHED THEN UPDATE SET page_token = @page_token, last_sync = SYSUTCDATETIME(), updated_at = SYSUTCDATETIME()
            WHEN NOT MATCHED THEN INSERT (user_id, provider, page_token, last_sync) VALUES (@user_id, @provider, @page_token, SYSUTCDATETIME());
          `);
      }
    }
  } catch {
    const result: any = await client.api("/me/calendarView")
      .query({ startDateTime: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), endDateTime: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString() })
      .get();
    events = result.value || [];
  }

  let count = 0;
  for (const event of events) {
    if (!event.id || event["@removed"]) continue;

    const startStr = event.start?.dateTime || event.start?.dateTime;
    const endStr = event.end?.dateTime || event.end?.dateTime;
    if (!startStr || !endStr) continue;

    const startTime = new Date(startStr);
    const endTime = new Date(endStr);
    const isAllDay = event.start?.dateTimeTimeZone === "timeZone" || false;

    await pool.request()
      .input("user_id", sql.Int, userId)
      .input("provider", sql.VarChar(20), "microsoft")
      .input("external_id", sql.NVarChar(500), event.id)
      .input("title", sql.NVarChar(500), event.subject || "Sin título")
      .input("description", sql.NVarChar(sql.MAX), event.body?.content || null)
      .input("start_time", sql.DateTime2, startTime)
      .input("end_time", sql.DateTime2, endTime)
      .input("location", sql.NVarChar(500), event.location?.displayName || null)
      .input("is_all_day", sql.Bit, isAllDay ? 1 : 0)
      .query(`
        MERGE crm.external_events AS target
        USING (SELECT @user_id AS user_id, @provider AS provider, @external_id AS external_id) AS source
        ON target.user_id = source.user_id AND target.provider = source.provider AND target.external_id = source.external_id
        WHEN MATCHED THEN UPDATE SET title = @title, description = @description, start_time = @start_time, end_time = @end_time, location = @location, is_all_day = @is_all_day, updated_at = SYSUTCDATETIME()
        WHEN NOT MATCHED THEN INSERT (user_id, provider, external_id, title, description, start_time, end_time, location, is_all_day) VALUES (@user_id, @provider, @external_id, @title, @description, @start_time, @end_time, @location, @is_all_day);
      `);

    count++;
  }

  return { count };
}

export async function getCalendarEvents(
  userId: number,
  companyId: number,
  options?: { from?: string; to?: string }
) {
  const pool = await getPool();

  let where = `WHERE ee.user_id = @user_id`;
  const request = pool.request().input("user_id", sql.Int, userId);

  const fromDate = options?.from ? new Date(options.from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const toDate = options?.to ? new Date(options.to) : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

  request.input("from_date", sql.DateTime2, fromDate);
  request.input("to_date", sql.DateTime2, toDate);
  where += ` AND ee.start_time >= @from_date AND ee.start_time <= @to_date`;

  const externalEvents = await request.query(`
    SELECT ee.id, ee.provider, ee.external_id, ee.title, ee.description,
           ee.start_time, ee.end_time, ee.location, ee.is_all_day, ee.linked_activity_id,
           NULL AS activity_id, NULL AS activity_type, NULL AS activity_status,
           NULL AS customer_id, NULL AS customer_name
      FROM crm.external_events ee
     ${where}
     ORDER BY ee.start_time ASC
  `);

  const crmActivities = await pool.request()
    .input("user_id", sql.Int, userId)
    .input("company_id", sql.Int, companyId)
    .input("from_date", sql.DateTime2, fromDate)
    .input("to_date", sql.DateTime2, toDate)
    .query(`
      SELECT a.activity_id AS id, 'crm' AS provider, CAST(a.activity_id AS NVARCHAR(500)) AS external_id,
             at.activity_type_name AS title, a.notes AS description,
             a.due_at AS start_time, DATEADD(HOUR, 1, a.due_at) AS end_time,
             NULL AS location, 0 AS is_all_day, NULL AS linked_activity_id,
             a.activity_id AS activity_id, at.activity_type_name AS activity_type, a.status AS activity_status,
             c.customer_id, c.customer_name
        FROM crm.activities a
        INNER JOIN cat.activity_types at ON at.activity_type_code = a.activity_type_code
        LEFT JOIN crm.customers c ON c.customer_id = a.customer_id
       WHERE a.owner_user_id = @user_id
         AND a.due_at >= @from_date AND a.due_at <= @to_date
       ORDER BY a.due_at ASC
  `);

  return {
    externalEvents: externalEvents.recordset,
    crmActivities: crmActivities.recordset,
  };
}

export async function createActivityFromEvent(
  userId: number,
  eventId: number,
  activityType?: string
): Promise<void> {
  const pool = await getPool();

  const event = await pool.request()
    .input("id", sql.Int, eventId)
    .input("user_id", sql.Int, userId)
    .query(`
      SELECT id, title, description, start_time, end_time, location, provider
        FROM crm.external_events WHERE id = @id AND user_id = @user_id
    `);

  if (!event.recordset[0]) {
    throw new HttpError(404, "Evento no encontrado");
  }

  const e = event.recordset[0];
  const type = activityType || "Visita";

  const activityResult = await pool.request()
    .input("user_id", sql.Int, userId)
    .input("title", type)
    .input("notes", e.description || `Evento sincronizado desde ${e.provider}: ${e.title}`)
    .input("due_at", e.start_time)
    .input("location", e.location || null)
    .query(`
      DECLARE @type_code VARCHAR(50);
      SELECT @type_code = activity_type_code FROM cat.activity_types WHERE activity_type_name = @title;
      IF @type_code IS NULL SET @type_code = 'Visita';

      INSERT INTO crm.activities (owner_user_id, activity_type_code, notes, due_at, location, status, created_at)
      VALUES (@user_id, @type_code, @notes, @due_at, @location, 'Programada', SYSUTCDATETIME());

      SELECT SCOPE_IDENTITY() AS activity_id;
    `);

  const activityId = activityResult.recordset[0]?.activity_id;

  if (activityId) {
    await pool.request()
      .input("event_id", sql.Int, eventId)
      .input("activity_id", sql.Int, activityId)
      .query(`UPDATE crm.external_events SET linked_activity_id = @activity_id WHERE id = @event_id`);
  }
}
