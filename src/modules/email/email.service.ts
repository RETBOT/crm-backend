import { google } from "googleapis";
import { Client } from "@microsoft/microsoft-graph-client";
import { ConfidentialClientApplication } from "@azure/msal-node";
import { env } from "../../config/env";
import { getPool, sql } from "../../db/sqlserver";
import { HttpError } from "../../shared/http-error";

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

async function refreshGoogleToken(account: EmailAccount): Promise<string> {
  const oauth2Client = new google.auth.OAuth2(
    env.oauth.googleClientId,
    env.oauth.googleClientSecret,
    `${env.appUrl}/email/callback/google`
  );

  oauth2Client.setCredentials({
    refresh_token: account.refresh_token,
  });

  const { credentials } = await oauth2Client.refreshAccessToken();
  const newAccessToken = credentials.access_token as string;

  const pool = await getPool();
  const expiresAt = credentials.expiry_date
    ? new Date(credentials.expiry_date)
    : null;

  await pool.request()
    .input("id", sql.Int, account.id)
    .input("access_token", sql.NVarChar(sql.MAX), newAccessToken)
    .input("token_expires_at", sql.DateTime2, expiresAt)
    .input("updated_at", sql.DateTime2, new Date())
    .query(`
      UPDATE sec.user_email_accounts
         SET access_token = @access_token,
             token_expires_at = @token_expires_at,
             updated_at = @updated_at
       WHERE id = @id
    `);

  return newAccessToken;
}

async function refreshMicrosoftToken(account: EmailAccount): Promise<string> {
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
    scopes: ["https://graph.microsoft.com/Mail.Send", "https://graph.microsoft.com/User.Read"],
  });

  if (!result?.accessToken) {
    throw new HttpError(500, "No se pudo renovar el token de Microsoft");
  }

  const pool = await getPool();
  const expiresAt = result.expiresOn ? new Date(result.expiresOn) : null;

  await pool.request()
    .input("id", sql.Int, account.id)
    .input("access_token", sql.NVarChar(sql.MAX), result.accessToken)
    .input("token_expires_at", sql.DateTime2, expiresAt)
    .input("updated_at", sql.DateTime2, new Date())
    .query(`
      UPDATE sec.user_email_accounts
         SET access_token = @access_token,
             token_expires_at = @token_expires_at,
             updated_at = @updated_at
       WHERE id = @id
    `);

  return result.accessToken;
}

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

  throw new HttpError(400, "Proveedor de correo no soportado");
}

export async function connectGoogleAccount(
  userId: number,
  code: string,
  redirectUri: string
): Promise<{ email: string }> {
  const oauth2Client = new google.auth.OAuth2(
    env.oauth.googleClientId,
    env.oauth.googleClientSecret,
    redirectUri
  );

  let tokens;
  try {
    const tokenResponse = await oauth2Client.getToken(code);
    tokens = tokenResponse.tokens;
  } catch (err: any) {
    const msg = err?.response?.data?.error_description || err?.message || "Error al obtener tokens de Google";
    throw new HttpError(400, `Error al conectar con Google: ${msg}`);
  }

  if (!tokens.access_token || !tokens.refresh_token) {
    throw new HttpError(400, "No se recibieron tokens válidos de Google");
  }

  oauth2Client.setCredentials(tokens);

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });
  const profile = await gmail.users.getProfile({ userId: "me" });
  const email = profile.data.emailAddress;

  if (!email) {
    throw new HttpError(400, "No se pudo obtener el correo de Google");
  }

  const pool = await getPool();
  const expiresAt = tokens.expiry_date ? new Date(tokens.expiry_date) : null;

  const existing = await pool.request()
    .input("user_id", sql.Int, userId)
    .input("provider", sql.VarChar(20), "google")
    .query<{ id: number }>(`
      SELECT id FROM sec.user_email_accounts
       WHERE user_id = @user_id AND provider = @provider
    `);

  if (existing.recordset.length > 0) {
    await pool.request()
      .input("user_id", sql.Int, userId)
      .input("provider", sql.VarChar(20), "google")
      .input("email", sql.VarChar(255), email)
      .input("access_token", sql.NVarChar(sql.MAX), tokens.access_token)
      .input("refresh_token", sql.NVarChar(sql.MAX), tokens.refresh_token)
      .input("token_expires_at", sql.DateTime2, expiresAt)
      .input("updated_at", sql.DateTime2, new Date())
      .query(`
        UPDATE sec.user_email_accounts
           SET email = @email,
               access_token = @access_token,
               refresh_token = @refresh_token,
               token_expires_at = @token_expires_at,
               is_active = 1,
               updated_at = @updated_at
         WHERE user_id = @user_id AND provider = @provider
      `);
  } else {
    await pool.request()
      .input("user_id", sql.Int, userId)
      .input("provider", sql.VarChar(20), "google")
      .input("email", sql.VarChar(255), email)
      .input("access_token", sql.NVarChar(sql.MAX), tokens.access_token)
      .input("refresh_token", sql.NVarChar(sql.MAX), tokens.refresh_token)
      .input("token_expires_at", sql.DateTime2, expiresAt)
      .input("connected_at", sql.DateTime2, new Date())
      .query(`
        INSERT INTO sec.user_email_accounts (user_id, provider, email, access_token, refresh_token, token_expires_at, connected_at)
        VALUES (@user_id, @provider, @email, @access_token, @refresh_token, @token_expires_at, @connected_at)
      `);
  }

  return { email };
}

export async function connectMicrosoftAccount(
  userId: number,
  code: string,
  redirectUri: string
): Promise<{ email: string }> {
  const msalConfig = {
    auth: {
      clientId: env.oauth.microsoftClientId,
      clientSecret: env.oauth.microsoftClientSecret,
      authority: `https://login.microsoftonline.com/${env.oauth.microsoftTenant}`,
    },
  };

  const cca = new ConfidentialClientApplication(msalConfig);

  const result = await cca.acquireTokenByCode({
    code,
    redirectUri,
    scopes: ["https://graph.microsoft.com/Mail.Send", "https://graph.microsoft.com/User.Read"],
  });

  if (!result?.accessToken) {
    throw new HttpError(400, "No se recibieron tokens válidos de Microsoft");
  }

  const client = Client.init({
    authProvider: (done) => {
      done(null, result.accessToken!);
    },
  });

  const user: any = await client.api("/me").get();
  const email = user.mail || user.userPrincipalName;

  if (!email) {
    throw new HttpError(400, "No se pudo obtener el correo de Microsoft");
  }

  const pool = await getPool();
  const expiresAt = result.expiresOn ? new Date(result.expiresOn) : null;

  const existing = await pool.request()
    .input("user_id", sql.Int, userId)
    .input("provider", sql.VarChar(20), "microsoft")
    .query<{ id: number }>(`
      SELECT id FROM sec.user_email_accounts
       WHERE user_id = @user_id AND provider = @provider
    `);

  if (existing.recordset.length > 0) {
    await pool.request()
      .input("user_id", sql.Int, userId)
      .input("provider", sql.VarChar(20), "microsoft")
      .input("email", sql.VarChar(255), email)
      .input("access_token", sql.NVarChar(sql.MAX), result.accessToken)
      .input("refresh_token", sql.NVarChar(sql.MAX), (result as any).refreshToken || null)
      .input("token_expires_at", sql.DateTime2, expiresAt)
      .input("updated_at", sql.DateTime2, new Date())
      .query(`
        UPDATE sec.user_email_accounts
           SET email = @email,
               access_token = @access_token,
               refresh_token = ISNULL(@refresh_token, refresh_token),
               token_expires_at = @token_expires_at,
               is_active = 1,
               updated_at = @updated_at
         WHERE user_id = @user_id AND provider = @provider
      `);
  } else {
    await pool.request()
      .input("user_id", sql.Int, userId)
      .input("provider", sql.VarChar(20), "microsoft")
      .input("email", sql.VarChar(255), email)
      .input("access_token", sql.NVarChar(sql.MAX), result.accessToken)
      .input("refresh_token", sql.NVarChar(sql.MAX), (result as any).refreshToken || null)
      .input("token_expires_at", sql.DateTime2, expiresAt)
      .input("connected_at", sql.DateTime2, new Date())
      .query(`
        INSERT INTO sec.user_email_accounts (user_id, provider, email, access_token, refresh_token, token_expires_at, connected_at)
        VALUES (@user_id, @provider, @email, @access_token, @refresh_token, @token_expires_at, @connected_at)
      `);
  }

  return { email };
}

export async function getUserEmailAccount(
  userId: number,
  provider: string
): Promise<EmailAccount | null> {
  const pool = await getPool();
  const result = await pool.request()
    .input("user_id", sql.Int, userId)
    .input("provider", sql.VarChar(20), provider)
    .query<EmailAccount>(`
      SELECT id, user_id, provider, email, access_token, refresh_token,
             token_expires_at, is_default, is_active
        FROM sec.user_email_accounts
       WHERE user_id = @user_id AND provider = @provider
    `);

  return result.recordset[0] || null;
}

export async function getUserDefaultEmailAccount(
  userId: number
): Promise<EmailAccount | null> {
  const pool = await getPool();
  const result = await pool.request()
    .input("user_id", sql.Int, userId)
    .query<EmailAccount>(`
      SELECT id, user_id, provider, email, access_token, refresh_token,
             token_expires_at, is_default, is_active
        FROM sec.user_email_accounts
       WHERE user_id = @user_id AND is_active = 1
       ORDER BY is_default DESC, connected_at DESC
       OFFSET 0 ROWS FETCH NEXT 1 ROWS ONLY
    `);

  return result.recordset[0] || null;
}

export async function sendEmailViaProvider(
  account: EmailAccount,
  to: string,
  subject: string,
  body: string,
  cc?: string | null,
  bcc?: string | null
): Promise<string> {
  const accessToken = await getValidToken(account);

  if (account.provider === "google") {
    return sendViaGmail(accessToken, to, subject, body, cc, bcc);
  }

  if (account.provider === "microsoft") {
    return sendViaMicrosoft(accessToken, to, subject, body, cc, bcc);
  }

  throw new HttpError(400, "Proveedor de correo no soportado");
}

function buildRawEmail(
  to: string,
  subject: string,
  body: string,
  cc?: string | null,
  bcc?: string | null
): string {
  const headers = [
    `To: ${to}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
  ];

  if (cc) headers.splice(1, 0, `Cc: ${cc}`);
  if (bcc) headers.splice(1, 0, `Bcc: ${bcc}`);

  const message = headers.join("\r\n") + "\r\n\r\n" + Buffer.from(body).toString("base64");
  return Buffer.from(message).toString("base64url");
}

async function sendViaGmail(
  accessToken: string,
  to: string,
  subject: string,
  body: string,
  cc?: string | null,
  bcc?: string | null
): Promise<string> {
  const oauth2Client = new google.auth.OAuth2(
    env.oauth.googleClientId,
    env.oauth.googleClientSecret
  );
  oauth2Client.setCredentials({ access_token: accessToken });

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });
  const raw = buildRawEmail(to, subject, body, cc, bcc);

  const result = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw },
  });

  return result.data.id || "";
}

function buildMicrosoftEmail(
  to: string,
  subject: string,
  body: string,
  cc?: string | null,
  bcc?: string | null
): any {
  const message: any = {
    subject,
    body: {
      contentType: "HTML",
      content: body,
    },
    toRecipients: [{ emailAddress: { address: to } }],
  };

  if (cc) {
    message.ccRecipients = [{ emailAddress: { address: cc } }];
  }

  if (bcc) {
    message.bccRecipients = [{ emailAddress: { address: bcc } }];
  }

  return message;
}

async function sendViaMicrosoft(
  accessToken: string,
  to: string,
  subject: string,
  body: string,
  cc?: string | null,
  bcc?: string | null
): Promise<string> {
  const client = Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    },
  });

  const message = buildMicrosoftEmail(to, subject, body, cc, bcc);

  const result: any = await client.api("/me/sendMail").post({
    message,
    saveToSentItems: true,
  });

  return result?.id || "";
}

export async function recordSentEmail(
  userId: number,
  companyId: number,
  provider: string,
  emailAccountId: number,
  to: string,
  subject: string,
  body: string,
  providerMessageId: string,
  cc?: string | null,
  bcc?: string | null,
  customerId?: number | null
): Promise<void> {
  const pool = await getPool();
  await pool.request()
    .input("user_id", sql.Int, userId)
    .input("company_id", sql.Int, companyId)
    .input("customer_id", sql.Int, customerId || null)
    .input("email_account_id", sql.Int, emailAccountId)
    .input("provider", sql.VarChar(20), provider)
    .input("to", sql.NVarChar(500), to)
    .input("cc", sql.NVarChar(500), cc || null)
    .input("bcc", sql.NVarChar(500), bcc || null)
    .input("subject", sql.NVarChar(500), subject)
    .input("body", sql.NVarChar(sql.MAX), body)
    .input("provider_message_id", sql.NVarChar(500), providerMessageId)
    .query(`
      INSERT INTO crm.email_sent (user_id, company_id, customer_id, email_account_id, provider, [to], cc, bcc, subject, body, provider_message_id, sent_at)
      VALUES (@user_id, @company_id, @customer_id, @email_account_id, @provider, @to, @cc, @bcc, @subject, @body, @provider_message_id, SYSUTCDATETIME())
    `);

  await pool.request()
    .input("id", sql.Int, emailAccountId)
    .input("updated_at", sql.DateTime2, new Date())
    .query(`
      UPDATE sec.user_email_accounts
         SET last_used_at = @updated_at
       WHERE id = @id
    `);
}

export async function getEmailHistory(
  userId: number,
  companyId: number,
  options?: { customerId?: number; limit?: number; offset?: number }
) {
  const pool = await getPool();
  const limit = options?.limit || 50;
  const offset = options?.offset || 0;

  let where = `WHERE e.user_id = @user_id AND e.company_id = @company_id`;
  const request = pool.request()
    .input("user_id", sql.Int, userId)
    .input("company_id", sql.Int, companyId)
    .input("limit", sql.Int, limit)
    .input("offset", sql.Int, offset);

  if (options?.customerId) {
    where += ` AND e.customer_id = @customer_id`;
    request.input("customer_id", sql.Int, options.customerId);
  }

  const result = await request.query(`
    SELECT e.id, e.customer_id, e.email_account_id, e.provider, e.[to], e.cc, e.bcc,
           e.subject, e.has_attachments, e.status, e.sent_at,
           c.customer_name, c.customer_code
      FROM crm.email_sent e
      LEFT JOIN crm.customers c ON c.customer_id = e.customer_id
     ${where}
     ORDER BY e.sent_at DESC
     OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
  `);

  const countResult = await request.query<{ total: number }>(`
    SELECT COUNT(*) AS total
      FROM crm.email_sent e
     ${where}
  `);

  return {
    emails: result.recordset,
    total: countResult.recordset[0]?.total || 0,
  };
}

export async function disconnectEmailAccount(
  userId: number,
  provider: string
): Promise<void> {
  const pool = await getPool();
  await pool.request()
    .input("user_id", sql.Int, userId)
    .input("provider", sql.VarChar(20), provider)
    .query(`
      UPDATE sec.user_email_accounts
         SET is_active = 0,
             access_token = '',
             refresh_token = NULL,
             updated_at = SYSUTCDATETIME()
       WHERE user_id = @user_id AND provider = @provider
    `);
}

export async function getUserEmailAccounts(userId: number) {
  const pool = await getPool();
  const result = await pool.request()
    .input("user_id", sql.Int, userId)
    .query(`
      SELECT id, provider, email, is_default, is_active, connected_at, last_used_at
        FROM sec.user_email_accounts
       WHERE user_id = @user_id
       ORDER BY is_default DESC, connected_at DESC
    `);

  return result.recordset;
}
