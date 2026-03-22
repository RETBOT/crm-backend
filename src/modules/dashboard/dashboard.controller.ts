import { Request, Response } from "express";
import { getHomeDashboardData } from "./dashboard.service";

export async function getDashboardHome(req: Request, res: Response): Promise<void> {
  const data = await getHomeDashboardData(req.auth!.companyId, req.auth!.userId);
  res.json(data);
}
