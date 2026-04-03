import nodemailer from "nodemailer";
import { env } from "../config/env";
import { logger } from "../config/logger";

logger.info({ host: env.smtp.host, port: env.smtp.port, user: env.smtp.user }, "SMTP configuration loaded");

const transporter = nodemailer.createTransport({
  host: env.smtp.host,
  port: env.smtp.port,
  secure: false,
  auth: {
    user: env.smtp.user,
    pass: env.smtp.pass,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

export async function sendPasswordResetEmail(
  to: string,
  username: string,
  resetLink: string
): Promise<void> {
  try {
    await transporter.verify();
    logger.info("SMTP connection verified");
  } catch (verifyError) {
    logger.error({ error: verifyError }, "SMTP verification failed");
    throw new Error("No se pudo conectar con el servidor de correo. Verifica la configuración.");
  }

  try {
    await transporter.sendMail({
      from: env.smtp.from,
      to,
      subject: "RETFlow CRM - Recuperar contraseña",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #1e3a5f; margin: 0;">RETFlow CRM</h1>
            <p style="color: #6b7280; margin: 4px 0 0;">Ejecuta tu crecimiento</p>
          </div>
          
          <div style="background: #f8fafc; border-radius: 12px; padding: 24px; border: 1px solid #e2e8f0;">
            <h2 style="color: #1e293b; margin: 0 0 12px;">Recuperar contraseña</h2>
            <p style="color: #475569; margin: 0 0 16px; line-height: 1.6;">
              Hola <strong>${username}</strong>, hemos recibido una solicitud para restablecer tu contraseña.
            </p>
            <p style="color: #475569; margin: 0 0 20px; line-height: 1.6;">
              Haz clic en el siguiente enlace para crear una nueva contraseña. Este enlace expirará en <strong>1 hora</strong>.
            </p>
            
            <div style="text-align: center; margin: 24px 0;">
              <a href="${resetLink}" 
                 style="background: #2563eb; color: white; padding: 12px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
                Restablecer contraseña
              </a>
            </div>
            
            <p style="color: #94a3b8; font-size: 13px; margin: 16px 0 0; line-height: 1.5;">
              Si no solicitaste este cambio, puedes ignorar este correo. Tu contraseña actual no cambiará.
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 24px; color: #94a3b8; font-size: 12px;">
            <p>&copy; ${new Date().getFullYear()} RETFlow CRM. Todos los derechos reservados.</p>
          </div>
        </div>
      `,
    });

    logger.info({ to, username }, "Password reset email sent");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : "";
    logger.error({ error: errorMessage, stack: errorStack, to, username }, "Failed to send password reset email");
    throw new Error(`No se pudo enviar el correo de recuperación: ${errorMessage}`);
  }
}
