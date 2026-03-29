import { Router } from "express";
import { db, activityLogsTable, usersTable } from "@workspace/db";
import { eq, desc, count } from "drizzle-orm";
import { ListActivityLogsQueryParams } from "@workspace/api-zod";
import { requireAuth, requireAdminOrPerm } from "../lib/auth.js";

const router = Router();

router.get("/", requireAuth, requireAdminOrPerm("canViewActivity"), async (req, res) => {
  const parsed = ListActivityLogsQueryParams.safeParse({
    limit: req.query.limit ? Number(req.query.limit) : 50,
    offset: req.query.offset ? Number(req.query.offset) : 0,
  });

  const limit = parsed.success ? (parsed.data.limit ?? 50) : 50;
  const offset = parsed.success ? (parsed.data.offset ?? 0) : 0;

  const [logs, [totalResult]] = await Promise.all([
    db
      .select({
        log: activityLogsTable,
        username: usersTable.username,
      })
      .from(activityLogsTable)
      .leftJoin(usersTable, eq(activityLogsTable.userId, usersTable.id))
      .orderBy(desc(activityLogsTable.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: count() }).from(activityLogsTable),
  ]);

  res.json({
    logs: logs.map(({ log, username }) => ({
      id: log.id,
      userId: log.userId ?? null,
      userUsername: username ?? null,
      action: log.action,
      entityType: log.entityType ?? null,
      entityId: log.entityId ?? null,
      details: log.details ?? null,
      ipAddress: log.ipAddress ?? null,
      createdAt: log.createdAt.toISOString(),
    })),
    total: totalResult?.count ?? 0,
  });
});

export default router;
