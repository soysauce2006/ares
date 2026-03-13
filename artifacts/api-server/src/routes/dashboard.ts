import { Router } from "express";
import { db, rosterTable, ranksTable, squadsTable, activityLogsTable, usersTable } from "@workspace/db";
import { eq, sql, desc, count } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";

const router = Router();

router.get("/stats", requireAuth, async (_req, res) => {
  const [
    [memberStats],
    squadCount,
    rankCount,
    recentLogs,
    membersByRankData,
    membersBySquadData,
  ] = await Promise.all([
    db
      .select({
        total: count(),
        active: sql<number>`count(*) filter (where ${rosterTable.status} = 'active')::int`,
      })
      .from(rosterTable),
    db.select({ count: count() }).from(squadsTable),
    db.select({ count: count() }).from(ranksTable),
    db
      .select({
        log: activityLogsTable,
        username: usersTable.username,
      })
      .from(activityLogsTable)
      .leftJoin(usersTable, eq(activityLogsTable.userId, usersTable.id))
      .orderBy(desc(activityLogsTable.createdAt))
      .limit(10),
    db
      .select({
        rankId: ranksTable.id,
        rankName: ranksTable.name,
        count: sql<number>`count(${rosterTable.id})::int`,
      })
      .from(ranksTable)
      .leftJoin(rosterTable, eq(rosterTable.rankId, ranksTable.id))
      .groupBy(ranksTable.id, ranksTable.name)
      .orderBy(ranksTable.level),
    db
      .select({
        squadId: squadsTable.id,
        squadName: squadsTable.name,
        count: sql<number>`count(${rosterTable.id})::int`,
      })
      .from(squadsTable)
      .leftJoin(rosterTable, eq(rosterTable.squadId, squadsTable.id))
      .groupBy(squadsTable.id, squadsTable.name)
      .orderBy(squadsTable.name),
  ]);

  res.json({
    totalMembers: Number(memberStats?.total ?? 0),
    activeMembers: Number(memberStats?.active ?? 0),
    totalSquads: Number(squadCount[0]?.count ?? 0),
    totalRanks: Number(rankCount[0]?.count ?? 0),
    recentActivity: recentLogs.map(({ log, username }) => ({
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
    membersByRank: membersByRankData.map(r => ({
      rankId: r.rankId,
      rankName: r.rankName,
      count: r.count,
    })),
    membersBySquad: membersBySquadData.map(s => ({
      squadId: s.squadId,
      squadName: s.squadName,
      count: s.count,
    })),
  });
});

export default router;
