import { Request, Response } from "express";
import {
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from "./notifications.service";

export async function getNotifications(req: Request, res: Response): Promise<void> {
  const data = await getUserNotifications(req.auth!.companyId, req.auth!.userId);
  res.json(data);
}

export async function getNotificationsBadge(req: Request, res: Response): Promise<void> {
  const count = await getUnreadCount(req.auth!.companyId, req.auth!.userId);
  res.json({ count });
}

export async function putNotificationRead(req: Request, res: Response): Promise<void> {
  const notificationId = Number(req.params.id);
  await markAsRead(req.auth!.companyId, req.auth!.userId, notificationId);
  res.json({ ok: true });
}

export async function putNotificationsReadAll(req: Request, res: Response): Promise<void> {
  await markAllAsRead(req.auth!.companyId, req.auth!.userId);
  res.json({ ok: true });
}
