import { Request, Response, NextFunction } from "express";
import { env } from "../../config/env";
import { connectEmailSchema, sendEmailSchema, emailHistoryQuerySchema } from "./email.schemas";
import {
  connectGoogleAccount,
  connectMicrosoftAccount,
  getUserDefaultEmailAccount,
  sendEmailViaProvider,
  recordSentEmail,
  getEmailHistory,
  disconnectEmailAccount,
  getUserEmailAccounts,
} from "./email.service";
import { HttpError } from "../../shared/http-error";

function getUserId(req: Request): number {
  return Number((req as any).auth?.userId);
}

function getCompanyId(req: Request): number {
  return Number((req as any).auth?.companyId);
}

export async function connectEmail(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);
    const { provider, code, redirectUri } = connectEmailSchema.parse(req.body);

    let result: { email: string };

    if (provider === "google") {
      result = await connectGoogleAccount(userId, code, redirectUri);
    } else {
      result = await connectMicrosoftAccount(userId, code, redirectUri);
    }

    res.json({
      message: `Cuenta de correo conectada exitosamente`,
      email: result.email,
      provider,
    });
  } catch (error) {
    next(error);
  }
}

export async function sendEmail(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);
    const companyId = getCompanyId(req);
    const { to, cc, bcc, subject, body, customerId } = sendEmailSchema.parse(req.body);

    const account = await getUserDefaultEmailAccount(userId);

    if (!account) {
      throw new HttpError(400, "No tienes una cuenta de correo conectada. Conecta tu Gmail o Outlook primero.");
    }

    if (!account.is_active) {
      throw new HttpError(400, "Tu cuenta de correo está desactivada. Vuelve a conectarla.");
    }

    const providerMessageId = await sendEmailViaProvider(
      account,
      to,
      subject,
      body,
      cc,
      bcc
    );

    await recordSentEmail(
      userId,
      companyId,
      account.provider,
      account.id,
      to,
      subject,
      body,
      providerMessageId,
      cc,
      bcc,
      customerId
    );

    res.json({
      message: "Correo enviado exitosamente",
      provider: account.provider,
      sentTo: to,
    });
  } catch (error) {
    next(error);
  }
}

export async function getEmailHistoryHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);
    const companyId = getCompanyId(req);
    const { customerId, limit, offset } = emailHistoryQuerySchema.parse(req.query);

    const history = await getEmailHistory(userId, companyId, {
      customerId,
      limit,
      offset,
    });

    res.json(history);
  } catch (error) {
    next(error);
  }
}

export async function disconnectEmailHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);
    const provider = Array.isArray(req.params.provider) ? req.params.provider[0] : req.params.provider;

    if (!["google", "microsoft"].includes(provider)) {
      throw new HttpError(400, "Proveedor no soportado");
    }

    await disconnectEmailAccount(userId, provider);

    res.json({ message: "Cuenta de correo desconectada exitosamente" });
  } catch (error) {
    next(error);
  }
}

export async function getConnectedAccounts(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);
    const accounts = await getUserEmailAccounts(userId);

    res.json({ accounts });
  } catch (error) {
    next(error);
  }
}

export async function getOAuthStatus(_req: Request, res: Response) {
  res.json({
    google: {
      configured: !!(env.oauth.googleClientId && env.oauth.googleClientSecret),
    },
    microsoft: {
      configured: !!(env.oauth.microsoftClientId && env.oauth.microsoftClientSecret),
    },
  });
}
