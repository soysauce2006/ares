import { Router } from "express";
import { db, squadsTable, rosterTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { CreateSquadBody, UpdateSquadBody, UpdateSquadParams, DeleteSquadParams } from "@workspace/api-zod";
import { requireAuth, requireManagerOrAdmin } from "../lib/auth.js";
import { logActivity } from "../lib/activity.js";

const router = Router();

router.get("/", requireAuth, async (_req, res) => {
  const squads = await db.select().from(squadsTable).orderBy(squadsTable.name);

  const memberCounts = await db
    .select({ squadId: rosterTable.squadId, count: sql<number>`count(*)::int` })
    .from(rosterTable)
    .groupBy(rosterTable.squadId);

  const countMap = new Map(memberCounts.map(r => [r.squadId, r.count]));

  res.json(
    squads.map(s => ({
      id: s.id,
      name: s.name,
      description: s.description ?? null,
      memberCount: countMap.get(s.id) ?? 0,
    }))
  );
});

router.post("/", requireAuth, requireManagerOrAdmin, async (req, res) => {
  const parsed = CreateSquadBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", message: parsed.error.message });
    return;
  }
  const [squad] = await db
    .insert(squadsTable)
    .values({ name: parsed.data.name, description: parsed.data.description ?? null })
    .returning();

  await logActivity(req, "squad.created", "squad", squad.id, `Created squad ${squad.name}`);
  res.status(201).json({ ...squad, description: squad.description ?? null, memberCount: 0 });
});

router.put("/:id", requireAuth, requireManagerOrAdmin, async (req, res) => {
  const paramParsed = UpdateSquadParams.safeParse({ id: Number(req.params.id) });
  if (!paramParsed.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  const parsed = UpdateSquadBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.description !== undefined) updates.description = parsed.data.description;

  const [squad] = await db
    .update(squadsTable)
    .set(updates)
    .where(eq(squadsTable.id, paramParsed.data.id))
    .returning();

  if (!squad) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  await logActivity(req, "squad.updated", "squad", squad.id, `Updated squad ${squad.name}`);
  res.json({ ...squad, description: squad.description ?? null, memberCount: 0 });
});

router.delete("/:id", requireAuth, requireManagerOrAdmin, async (req, res) => {
  const parsed = DeleteSquadParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  await db.delete(squadsTable).where(eq(squadsTable.id, parsed.data.id));
  await logActivity(req, "squad.deleted", "squad", parsed.data.id, `Deleted squad ID ${parsed.data.id}`);
  res.json({ message: "Squad deleted" });
});

export default router;
