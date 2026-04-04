import cron from "node-cron";
import nodemailer from "nodemailer";
import ExcelJS from "exceljs";
import { getPool, sql } from "../db/sqlserver";
import { env } from "../config/env";
import { logger } from "../config/logger";
import {
  getDashboardExecutive,
  getSalesReport,
  getCustomersReport,
  getActivitiesReport,
  getOpportunitiesReport,
  getProductsReport,
} from "./reports.service";

const reportGenerators: Record<string, Function> = {
  dashboard: getDashboardExecutive,
  sales: getSalesReport,
  customers: getCustomersReport,
  activities: getActivitiesReport,
  opportunities: getOpportunitiesReport,
  products: getProductsReport,
};

async function generateExcelBuffer(reportType: string, data: any): Promise<Buffer | null> {
  const reportData = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
  if (reportData.length === 0) return null;

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(`Reporte ${reportType}`);

  const headers = Object.keys(reportData[0]).map((key) => ({
    header: key.replace(/_/g, " ").toUpperCase(),
    key: key,
  }));
  worksheet.columns = headers;

  reportData.forEach((row: any) => {
    worksheet.addRow(row);
  });

  worksheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF4472C4" },
  };
  worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

  worksheet.columns.forEach((col) => {
    if (col) {
      let maxLength = 0;
      (col as any).eachCell?.({ includeEmpty: false }, (cell: any) => {
        const length = cell.value ? String(cell.value).length : 10;
        if (length > maxLength) maxLength = length;
      });
      col.width = Math.min(Math.max(maxLength + 2, 12), 50);
    }
  });

  return await workbook.xlsx.writeBuffer();
}

async function sendScheduledEmail(
  recipients: string[],
  reportType: string,
  excelBuffer: Buffer
): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: false,
    auth: {
      user: env.smtp.user,
      pass: env.smtp.pass,
    },
  });

  await transporter.sendMail({
    from: env.smtp.from,
    to: recipients.join(", "),
    subject: `RETFlow CRM - Reporte ${reportType}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1e3a5f;">RETFlow CRM</h2>
        <p>Reporte programado: <strong>${reportType}</strong></p>
        <p>El reporte adjunto fue generado automaticamente.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="color: #94a3b8; font-size: 12px;">&copy; ${new Date().getFullYear()} RETFlow CRM</p>
      </div>
    `,
    attachments: [
      {
        filename: `reporte_${reportType}_${new Date().toISOString().split("T")[0]}.xlsx`,
        content: excelBuffer,
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    ],
  });

  logger.info({ recipients, reportType }, "Scheduled report email sent");
}

function calculateNextRun(frequency: string, dayOfWeek?: number, dayOfMonth?: number): Date {
  const now = new Date();
  const next = new Date(now);

  switch (frequency) {
    case "hourly":
      next.setHours(next.getHours() + 1, 0, 0, 0);
      break;
    case "daily":
      next.setDate(next.getDate() + 1);
      next.setHours(0, 0, 0, 0);
      break;
    case "weekly":
      const targetDay = dayOfWeek ?? 1;
      const daysUntilTarget = (targetDay - next.getDay() + 7) % 7;
      next.setDate(next.getDate() + (daysUntilTarget === 0 ? 7 : daysUntilTarget));
      next.setHours(0, 0, 0, 0);
      break;
    case "monthly":
      const targetDayOfMonth = dayOfMonth ?? 1;
      next.setMonth(next.getMonth() + 1);
      next.setDate(targetDayOfMonth);
      next.setHours(0, 0, 0, 0);
      break;
    default:
      next.setDate(next.getDate() + 1);
      next.setHours(0, 0, 0, 0);
  }

  return next;
}

export function startReportScheduler(): void {
  logger.info("Report scheduler started");

  // Run every minute to check for due reports
  cron.schedule("* * * * *", async () => {
    try {
      const pool = await getPool();
      const now = new Date();

      const result = await pool.request().query<{
        scheduled_id: number;
        company_id: number;
        user_id: number;
        report_type: string;
        frequency: string;
        day_of_week: number | null;
        day_of_month: number | null;
        recipients: string;
        filters: string;
        next_run_at: Date;
      }(`
        SELECT scheduled_id, company_id, user_id, report_type, frequency,
               day_of_week, day_of_month, recipients, filters, next_run_at
        FROM crm.report_scheduled
        WHERE is_active = 1 AND next_run_at <= SYSUTCDATETIME();
      `);

      for (const row of result.recordset) {
        try {
          const filters = row.filters ? JSON.parse(row.filters) : {};
          const recipients = row.recipients.split(",").map((r: string) => r.trim());
          const generator = reportGenerators[row.report_type];

          if (!generator) {
            logger.warn({ reportType: row.report_type }, "Unknown report type for scheduled report");
            continue;
          }

          const data = await generator(row.company_id, row.user_id, filters);
          const excelBuffer = await generateExcelBuffer(row.report_type, data);

          if (excelBuffer) {
            await sendScheduledEmail(recipients, row.report_type, excelBuffer);
          }

          // Update next_run_at
          const nextRun = calculateNextRun(row.frequency, row.day_of_week ?? undefined, row.day_of_month ?? undefined);
          await pool
            .request()
            .input("scheduled_id", sql.Int, row.scheduled_id)
            .input("next_run_at", sql.DateTime2, nextRun)
            .query(`
              UPDATE crm.report_scheduled
              SET next_run_at = @next_run_at, last_run_at = SYSUTCDATETIME()
              WHERE scheduled_id = @scheduled_id;
            `);

          logger.info({ scheduled_id: row.scheduled_id, nextRun }, "Scheduled report processed");
        } catch (err) {
          logger.error({ scheduled_id: row.scheduled_id, error: err }, "Error processing scheduled report");
        }
      }
    } catch (err) {
      logger.error({ error: err }, "Error in report scheduler");
    }
  });
}
