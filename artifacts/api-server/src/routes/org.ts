import { Router } from "express";
import { db, orgLevel1Table, orgLevel2Table, squadsTable, rosterTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth, requireAdmin, requireManagerOrAdmin } from "../lib/auth.js";
import { logActivity } from "../lib/activity.js";

const router = Router();

// ─── Level 1 ────────────────────────────────────────────────────────────────

router.get("/org-level1", requireAuth, async (req, res) => {
  const rows = await db.select().from(orgLevel1Table).orderBy(orgLevel1Table.name);
  const counts = await db
    .select({ level1Id: orgLevel2Table.level1Id, count: sql<number>`count(*)` })
    .from(orgLevel2Table)
    .where(sql`${orgLevel2Table.level1Id} is not null`)
    .groupBy(orgLevel2Table.level1Id);
  const countMap: Record<number, number> = {};
  for (const c of counts) if (c.level1Id) countMap[c.level1Id] = Number(c.count);

  res.json(rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    memberCount: countMap[r.id] ?? 0,
    createdAt: r.createdAt.toISOString(),
  })));
});

router.post("/org-level1", requireAuth, requireManagerOrAdmin, async (req, res) => {
  const { name, description } = req.body;
  if (!name) { res.status(400).json({ error: "Name required" }); return; }
  const [row] = await db.insert(orgLevel1Table).values({ name, description }).returning();
  await logActivity(req, "org.level1.created", "org_level1", row.id, `Created: ${row.name}`);
  res.status(201).json({ id: row.id, name: row.name, description: row.description, memberCount: 0, createdAt: row.createdAt.toISOString() });
});

router.put("/org-level1/:id", requireAuth, requireManagerOrAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  const { name, description } = req.body;
  const [row] = await db.update(orgLevel1Table).set({ name, description, updatedAt: new Date() }).where(eq(orgLevel1Table.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await logActivity(req, "org.level1.updated", "org_level1", row.id, `Updated: ${row.name}`);
  res.json({ id: row.id, name: row.name, description: row.description, memberCount: 0, createdAt: row.createdAt.toISOString() });
});

router.delete("/org-level1/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  await db.update(orgLevel2Table).set({ level1Id: null }).where(eq(orgLevel2Table.level1Id, id));
  const [row] = await db.delete(orgLevel1Table).where(eq(orgLevel1Table.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await logActivity(req, "org.level1.deleted", "org_level1", id, `Deleted: ${row.name}`);
  res.json({ message: "Deleted" });
});

// ─── Level 2 ────────────────────────────────────────────────────────────────

router.get("/org-level2", requireAuth, async (req, res) => {
  const rows = await db.select().from(orgLevel2Table).orderBy(orgLevel2Table.name);
  const level1s = await db.select().from(orgLevel1Table);
  const level1Map: Record<number, string> = {};
  for (const l of level1s) level1Map[l.id] = l.name;

  const squadCounts = await db
    .select({ level2Id: squadsTable.level2Id, count: sql<number>`count(*)` })
    .from(squadsTable)
    .where(sql`${squadsTable.level2Id} is not null`)
    .groupBy(squadsTable.level2Id);
  const countMap: Record<number, number> = {};
  for (const c of squadCounts) if (c.level2Id) countMap[c.level2Id] = Number(c.count);

  res.json(rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    level1Id: r.level1Id,
    level1Name: r.level1Id ? (level1Map[r.level1Id] ?? null) : null,
    memberCount: countMap[r.id] ?? 0,
    createdAt: r.createdAt.toISOString(),
  })));
});

router.post("/org-level2", requireAuth, requireManagerOrAdmin, async (req, res) => {
  const { name, description, level1Id } = req.body;
  if (!name) { res.status(400).json({ error: "Name required" }); return; }
  const [row] = await db.insert(orgLevel2Table).values({ name, description, level1Id: level1Id ?? null }).returning();
  await logActivity(req, "org.level2.created", "org_level2", row.id, `Created: ${row.name}`);
  res.status(201).json({ id: row.id, name: row.name, description: row.description, level1Id: row.level1Id, level1Name: null, memberCount: 0, createdAt: row.createdAt.toISOString() });
});

router.put("/org-level2/:id", requireAuth, requireManagerOrAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  const { name, description, level1Id } = req.body;
  const [row] = await db.update(orgLevel2Table).set({ name, description, level1Id: level1Id ?? null, updatedAt: new Date() }).where(eq(orgLevel2Table.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await logActivity(req, "org.level2.updated", "org_level2", row.id, `Updated: ${row.name}`);
  res.json({ id: row.id, name: row.name, description: row.description, level1Id: row.level1Id, level1Name: null, memberCount: 0, createdAt: row.createdAt.toISOString() });
});

router.delete("/org-level2/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  await db.update(squadsTable).set({ level2Id: null }).where(eq(squadsTable.level2Id, id));
  const [row] = await db.delete(orgLevel2Table).where(eq(orgLevel2Table.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await logActivity(req, "org.level2.deleted", "org_level2", id, `Deleted: ${row.name}`);
  res.json({ message: "Deleted" });
});

export default router;
