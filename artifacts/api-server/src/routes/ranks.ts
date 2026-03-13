import { Router } from "express";
import { db, ranksTable, rosterTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { CreateRankBody, UpdateRankBody, UpdateRankParams, DeleteRankParams } from "@workspace/api-zod";
import { requireAuth, requireManagerOrAdmin } from "../lib/auth.js";
import { logActivity } from "../lib/activity.js";

const router = Router();

router.get("/", requireAuth, async (_req, res) => {
  const ranks = await db.select().from(ranksTable).orderBy(ranksTable.level);

  const memberCounts = await db
    .select({ rankId: rosterTable.rankId, count: sql<number>`count(*)::int` })
    .from(rosterTable)
    .groupBy(rosterTable.rankId);

  const countMap = new Map(memberCounts.map(r => [r.rankId, r.count]));

  res.json(
    ranks.map(r => ({
      id: r.id,
      name: r.name,
      abbreviation: r.abbreviation,
      level: r.level,
      description: r.description ?? null,
      memberCount: countMap.get(r.id) ?? 0,
    }))
  );
});

router.post("/", requireAuth, requireManagerOrAdmin, async (req, res) => {
  const parsed = CreateRankBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", message: parsed.error.message });
    return;
  }
  const [rank] = await db
    .insert(ranksTable)
    .values({
      name: parsed.data.name,
      abbreviation: parsed.data.abbreviation,
      level: parsed.data.level,
      description: parsed.data.description ?? null,
    })
    .returning();

  await logActivity(req, "rank.created", "rank", rank.id, `Created rank ${rank.name}`);
  res.status(201).json({ ...rank, description: rank.description ?? null, memberCount: 0 });
});

router.put("/:id", requireAuth, requireManagerOrAdmin, async (req, res) => {
  const paramParsed = UpdateRankParams.safeParse({ id: Number(req.params.id) });
  if (!paramParsed.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  const parsed = UpdateRankBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.abbreviation !== undefined) updates.abbreviation = parsed.data.abbreviation;
  if (parsed.data.level !== undefined) updates.level = parsed.data.level;
  if (parsed.data.description !== undefined) updates.description = parsed.data.description;

  const [rank] = await db
    .update(ranksTable)
    .set(updates)
    .where(eq(ranksTable.id, paramParsed.data.id))
    .returning();

  if (!rank) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  await logActivity(req, "rank.updated", "rank", rank.id, `Updated rank ${rank.name}`);
  res.json({ ...rank, description: rank.description ?? null, memberCount: 0 });
});

router.delete("/:id", requireAuth, requireManagerOrAdmin, async (req, res) => {
  const parsed = DeleteRankParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  await db.delete(ranksTable).where(eq(ranksTable.id, parsed.data.id));
  await logActivity(req, "rank.deleted", "rank", parsed.data.id, `Deleted rank ID ${parsed.data.id}`);
  res.json({ message: "Rank deleted" });
});

export default router;
