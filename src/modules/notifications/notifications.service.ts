import { getPool, sql } from "../../db/sqlserver";

export interface NotificationRow {
  notification_id: number;
  type: string;
  title: string;
  message: string;
  activity_id: number | null;
  is_read: boolean;
  created_at: Date;
  subject: string | null;
  customer_name: string | null;
  due_at: Date | null;
  priority_code: string | null;
}

const DUE_SOON_HOURS = 4;

export async function getUserNotifications(companyId: number, userId: number): Promise<NotificationRow[]> {
  const pool = await getPool();

  await ensureDueSoonNotifications(companyId, userId);
  await ensureOverdueNotifications(companyId, userId);

  const result = await pool
    .request()
    .input("company_id", sql.Int, companyId)
    .input("user_id", sql.Int, userId)
    .query<NotificationRow>(`
      SELECT TOP 20
        n.notification_id,
        n.type,
        n.title,
        n.message,
        n.activity_id,
        n.is_read,
        n.created_at,
        a.subject,
        c.customer_name,
        a.due_at,
        a.priority_code
      FROM crm.notifications n
      LEFT JOIN crm.activities a ON a.company_id = n.company_id AND a.activity_id = n.activity_id
      LEFT JOIN crm.customers c ON c.company_id = n.company_id AND c.customer_id = a.customer_id
      WHERE n.company_id = @company_id
        AND n.user_id = @user_id
      ORDER BY n.is_read ASC, n.created_at DESC;
    `);

  return result.recordset;
}

export async function getUnreadCount(companyId: number, userId: number): Promise<number> {
  const pool = await getPool();

  const result = await pool
    .request()
    .input("company_id", sql.Int, companyId)
    .input("user_id", sql.Int, userId)
    .query<{ count: number }>(`
      SELECT COUNT(1) AS count
      FROM crm.notifications
      WHERE company_id = @company_id
        AND user_id = @user_id
        AND is_read = 0;
    `);

  return result.recordset[0]?.count ?? 0;
}

export async function markAsRead(companyId: number, userId: number, notificationId: number): Promise<void> {
  const pool = await getPool();

  await pool
    .request()
    .input("company_id", sql.Int, companyId)
    .input("user_id", sql.Int, userId)
    .input("notification_id", sql.Int, notificationId)
    .query(`
      UPDATE crm.notifications
      SET is_read = 1, read_at = SYSUTCDATETIME()
      WHERE company_id = @company_id
        AND user_id = @user_id
        AND notification_id = @notification_id
        AND is_read = 0;
    `);
}

export async function markAllAsRead(companyId: number, userId: number): Promise<void> {
  const pool = await getPool();

  await pool
    .request()
    .input("company_id", sql.Int, companyId)
    .input("user_id", sql.Int, userId)
    .query(`
      UPDATE crm.notifications
      SET is_read = 1, read_at = SYSUTCDATETIME()
      WHERE company_id = @company_id
        AND user_id = @user_id
        AND is_read = 0;
    `);
}

export async function createAssignedNotification(
  companyId: number,
  assignedUserId: number,
  activityId: number,
  subject: string,
  assignedByName: string
): Promise<void> {
  const pool = await getPool();

  await pool
    .request()
    .input("company_id", sql.Int, companyId)
    .input("user_id", sql.Int, assignedUserId)
    .input("type", sql.VarChar(30), "assigned")
    .input("title", sql.NVarChar(200), "Nueva actividad asignada")
    .input("message", sql.NVarChar(500), `${assignedByName} te asignó: "${subject}"`)
    .input("activity_id", sql.Int, activityId)
    .query(`
      INSERT INTO crm.notifications (company_id, user_id, type, title, message, activity_id)
      VALUES (@company_id, @user_id, @type, @title, @message, @activity_id);
    `);
}

async function ensureDueSoonNotifications(companyId: number, userId: number): Promise<void> {
  const pool = await getPool();

  await pool
    .request()
    .input("company_id", sql.Int, companyId)
    .input("user_id", sql.Int, userId)
    .input("hours", sql.Int, DUE_SOON_HOURS)
    .query(`
      INSERT INTO crm.notifications (company_id, user_id, type, title, message, activity_id)
      SELECT
        a.company_id,
        a.owner_user_id,
        'due_soon',
        'Actividad proxima a vencer',
        'La actividad "' + a.subject + '" vence pronto',
        a.activity_id
      FROM crm.activities a
      WHERE a.company_id = @company_id
        AND a.owner_user_id = @user_id
        AND a.status IN ('Pendiente', 'Programada')
        AND a.due_at IS NOT NULL
        AND a.due_at > SYSUTCDATETIME()
        AND a.due_at <= DATEADD(HOUR, @hours, SYSUTCDATETIME())
        AND NOT EXISTS (
          SELECT 1 FROM crm.notifications n
          WHERE n.company_id = a.company_id
            AND n.user_id = a.owner_user_id
            AND n.activity_id = a.activity_id
            AND n.type = 'due_soon'
            AND n.is_read = 0
        );
    `);
}

async function ensureOverdueNotifications(companyId: number, userId: number): Promise<void> {
  const pool = await getPool();

  await pool
    .request()
    .input("company_id", sql.Int, companyId)
    .input("user_id", sql.Int, userId)
    .query(`
      INSERT INTO crm.notifications (company_id, user_id, type, title, message, activity_id)
      SELECT
        a.company_id,
        a.owner_user_id,
        'overdue',
        'Actividad vencida',
        'La actividad "' + a.subject + '" esta vencida (' + CAST(DATEDIFF(DAY, a.due_at, SYSUTCDATETIME()) AS VARCHAR) + ' dias)',
        a.activity_id
      FROM crm.activities a
      WHERE a.company_id = @company_id
        AND a.owner_user_id = @user_id
        AND a.status IN ('Pendiente', 'Programada')
        AND a.due_at IS NOT NULL
        AND a.due_at < SYSUTCDATETIME()
        AND NOT EXISTS (
          SELECT 1 FROM crm.notifications n
          WHERE n.company_id = a.company_id
            AND n.user_id = a.owner_user_id
            AND n.activity_id = a.activity_id
            AND n.type = 'overdue'
            AND n.is_read = 0
        );
    `);
}
