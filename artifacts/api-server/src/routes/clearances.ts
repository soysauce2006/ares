import { Router } from "express";
import { db, clearanceLevelsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../lib/auth.js";
import { logActivity } from "../lib/activity.js";

const router = Router();

const VALID_COLORS = ["amber", "red", "green", "blue", "violet", "orange", "gray"];

function formatClearance(c: typeof clearanceLevelsTable.$inferSelect) {
  return {
    id: c.id,
    name: c.name,
    level: c.level,
    description: c.description ?? null,
    color: c.color,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

router.get("/", requireAuth, async (_req, res) => {
  const rows = await db
    .select()
    .from(clearanceLevelsTable)
    .orderBy(clearanceLevelsTable.level);
  res.json(rows.map(formatClearance));
});

router.post("/", requireAuth, requireAdmin, async (req, res) => {
  const { name, level, description, color } = req.body;
  if (!name || typeof level !== "number") {
    res.status(400).json({ error: "name and level (number) are required" });
    return;
  }
  const [row] = await db
    .insert(clearanceLevelsTable)
    .values({
      name,
      level,
      description: description ?? null,
      color: VALID_COLORS.includes(color) ? color : "amber",
    })
    .returning();
  await logActivity(req, "clearance.created", "clearance", row.id, `Created clearance "${row.name}" (Level ${row.level})`);
  res.status(201).json(formatClearance(row));
});

router.put("/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const { name, level, description, color } = req.body;
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (name !== undefined) updates.name = name;
  if (level !== undefined) updates.level = level;
  if (description !== undefined) updates.description = description ?? null;
  if (color !== undefined) updates.color = VALID_COLORS.includes(color) ? color : "amber";

  const [row] = await db
    .update(clearanceLevelsTable)
    .set(updates)
    .where(eq(clearanceLevelsTable.id, id))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }

  await logActivity(req, "clearance.updated", "clearance", row.id, `Updated clearance "${row.name}"`);
  res.json(formatClearance(row));
});

router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  // Unlink users assigned this clearance
  await db.update(usersTable).set({ clearanceId: null }).where(eq(usersTable.clearanceId, id));

  const [row] = await db
    .delete(clearanceLevelsTable)
    .where(eq(clearanceLevelsTable.id, id))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }

  await logActivity(req, "clearance.deleted", "clearance", id, `Deleted clearance "${row.name}"`);
  res.json({ message: "Deleted" });
});

export default router;
