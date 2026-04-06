import { Request, Response, NextFunction } from "express";
import { templateSchema, signatureSchema, trackOpenSchema, trackClickSchema, sendWithTemplateSchema } from "./email-advanced.schemas";
import {
  getEmailTemplates,
  createEmailTemplate,
  updateEmailTemplate,
  deleteEmailTemplate,
  getTemplateById,
  applyTemplateVariables,
  trackEmailOpen,
  trackEmailClick,
  getUserSignature,
  saveUserSignature,
  getEmailTrackingStats,
} from "./email-advanced.service";
import { getUserDefaultEmailAccount, sendEmailViaProvider, recordSentEmail } from "../email/email.service";
import { HttpError } from "../../shared/http-error";

function getUserId(req: Request): number {
  return Number((req as any).auth?.userId);
}

function getCompanyId(req: Request): number {
  return Number((req as any).auth?.companyId);
}

export async function listTemplates(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);
    const companyId = getCompanyId(req);
    const templates = await getEmailTemplates(userId, companyId);
    res.json({ templates });
  } catch (error) {
    next(error);
  }
}

export async function createTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);
    const companyId = getCompanyId(req);
    const data = templateSchema.parse(req.body);
    const id = await createEmailTemplate(userId, companyId, data);
    res.json({ message: "Plantilla creada", id });
  } catch (error) {
    next(error);
  }
}

export async function updateTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);
    const companyId = getCompanyId(req);
    const templateId = Number(req.params.id);
    const data = templateSchema.parse(req.body);
    await updateEmailTemplate(userId, companyId, templateId, data);
    res.json({ message: "Plantilla actualizada" });
  } catch (error) {
    next(error);
  }
}

export async function deleteTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);
    const companyId = getCompanyId(req);
    const templateId = Number(req.params.id);
    await deleteEmailTemplate(userId, companyId, templateId);
    res.json({ message: "Plantilla eliminada" });
  } catch (error) {
    next(error);
  }
}

export async function sendWithTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);
    const companyId = getCompanyId(req);
    const { to, cc, bcc, templateId, variables = {}, customerId } = sendWithTemplateSchema.parse(req.body);

    const template = await getTemplateById(templateId);
    if (!template) {
      throw new HttpError(404, "Plantilla no encontrada");
    }

    const subject = applyTemplateVariables(template.subject, variables);
    let body = applyTemplateVariables(template.body, variables);

    const signature = await getUserSignature(userId);
    if (signature) {
      body += `<br><br>${signature.signature_html}`;
    }

    const account = await getUserDefaultEmailAccount(userId);
    if (!account) {
      throw new HttpError(400, "No tienes una cuenta de correo conectada");
    }

    const providerMessageId = await sendEmailViaProvider(account, to, subject, body, cc, bcc);
    await recordSentEmail(userId, companyId, account.provider, account.id, to, subject, body, providerMessageId, cc, bcc, customerId);

    res.json({ message: "Correo enviado con plantilla", sentTo: to });
  } catch (error) {
    next(error);
  }
}

export async function handleTrackOpen(req: Request, res: Response, next: NextFunction) {
  try {
    const emailId = Number(req.params.emailId);
    await trackEmailOpen(emailId);
    res.set("Content-Type", "image/gif");
    const pixel = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
    res.send(pixel);
  } catch (error) {
    next(error);
  }
}

export async function handleTrackClick(req: Request, res: Response, next: NextFunction) {
  try {
    const { emailId, link } = trackClickSchema.parse(req.body);
    await trackEmailClick(emailId, link);
    res.json({ tracked: true });
  } catch (error) {
    next(error);
  }
}

export async function getSignature(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);
    const signature = await getUserSignature(userId);
    res.json({ signature });
  } catch (error) {
    next(error);
  }
}

export async function saveSignature(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);
    const { signatureHtml, isDefault } = signatureSchema.parse(req.body);
    await saveUserSignature(userId, signatureHtml, isDefault);
    res.json({ message: "Firma guardada" });
  } catch (error) {
    next(error);
  }
}

export async function getTrackingStats(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);
    const companyId = getCompanyId(req);
    const stats = await getEmailTrackingStats(userId, companyId);
    res.json(stats);
  } catch (error) {
    next(error);
  }
}
