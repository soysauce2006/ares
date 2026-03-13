import { Router } from "express";
import { db, squadsTable, rosterTable, orgLevel2Table } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth, requireManagerOrAdmin } from "../lib/auth.js";
import { logActivity } from "../lib/activity.js";

const router = Router();

async function getSquadsWithMeta() {
  const squads = await db.select().from(squadsTable).orderBy(squadsTable.name);
  const memberCounts = await db
    .select({ squadId: rosterTable.squadId, count: sql<number>`count(*)::int` })
    .from(rosterTable)
    .groupBy(rosterTable.squadId);
  const countMap = new Map(memberCounts.map(r => [r.squadId, r.count]));

  const level2s = await db.select().from(orgLevel2Table);
  const level2Map = new Map(level2s.map(l => [l.id, l.name]));

  return squads.map(s => ({
    id: s.id,
    name: s.name,
    description: s.description ?? null,
    level2Id: s.level2Id ?? null,
    level2Name: s.level2Id ? (level2Map.get(s.level2Id) ?? null) : null,
    memberCount: countMap.get(s.id) ?? 0,
  }));
}

router.get("/", requireAuth, async (_req, res) => {
  res.json(await getSquadsWithMeta());
});

router.post("/", requireAuth, requireManagerOrAdmin, async (req, res) => {
  const { name, description, level2Id } = req.body;
  if (!name) { res.status(400).json({ error: "Name required" }); return; }
  const [squad] = await db
    .insert(squadsTable)
    .values({ name, description: description ?? null, level2Id: level2Id ?? null })
    .returning();
  await logActivity(req, "squad.created", "squad", squad.id, `Created squad ${squad.name}`);
  res.status(201).json({ id: squad.id, name: squad.name, description: squad.description ?? null, level2Id: squad.level2Id ?? null, level2Name: null, memberCount: 0 });
});

router.put("/:id", requireAuth, requireManagerOrAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const { name, description, level2Id } = req.body;

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (level2Id !== undefined) updates.level2Id = level2Id ?? null;

  const [squad] = await db.update(squadsTable).set(updates).where(eq(squadsTable.id, id)).returning();
  if (!squad) { res.status(404).json({ error: "Not found" }); return; }
  await logActivity(req, "squad.updated", "squad", squad.id, `Updated squad ${squad.name}`);
  res.json({ id: squad.id, name: squad.name, description: squad.description ?? null, level2Id: squad.level2Id ?? null, level2Name: null, memberCount: 0 });
});

router.delete("/:id", requireAuth, requireManagerOrAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  await db.delete(squadsTable).where(eq(squadsTable.id, id));
  await logActivity(req, "squad.deleted", "squad", id, `Deleted squad ID ${id}`);
  res.json({ message: "Squad deleted" });
});

export default router;
