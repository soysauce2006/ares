import { db, activityLogsTable } from "@workspace/db";
import { Request } from "express";

export async function logActivity(
  req: Request,
  action: string,
  entityType?: string,
  entityId?: number,
  details?: string
) {
  try {
    const user = (req as any).user;
    await db.insert(activityLogsTable).values({
      userId: user?.id ?? null,
      action,
      entityType: entityType ?? null,
      entityId: entityId ?? null,
      details: details ?? null,
      ipAddress: req.ip ?? null,
    });
  } catch {
    // Don't let activity logging failure break requests
  }
}
