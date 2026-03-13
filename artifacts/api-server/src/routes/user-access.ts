import { Router } from "express";
import { db, userAccessTable, orgLevel1Table, orgLevel2Table, squadsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../lib/auth.js";
import { logActivity } from "../lib/activity.js";

const router = Router({ mergeParams: true });

const SENTINEL_TYPE = "none";
const SENTINEL_ID = 0;

async function buildGrantResponse(userId: number) {
  const rows = await db.select().from(userAccessTable).where(eq(userAccessTable.userId, userId));

  const hasSentinel = rows.some(r => r.grantType === SENTINEL_TYPE && r.grantId === SENTINEL_ID);
  const realGrants = rows.filter(r => r.grantType !== SENTINEL_TYPE);

  if (rows.length === 0) {
    return { userId, unrestricted: true, grants: [] };
  }

  const level1s = await db.select().from(orgLevel1Table);
  const level2s = await db.select().from(orgLevel2Table);
  const squads = await db.select().from(squadsTable);
  const level1Map = new Map(level1s.map(l => [l.id, l.name]));
  const level2Map = new Map(level2s.map(l => [l.id, l.name]));
  const squadMap = new Map(squads.map(s => [s.id, s.name]));

  const enriched = realGrants.map(g => {
    let grantName = "Unknown";
    if (g.grantType === "level1") grantName = level1Map.get(g.grantId) ?? "Unknown";
    else if (g.grantType === "level2") grantName = level2Map.get(g.grantId) ?? "Unknown";
    else if (g.grantType === "squad") grantName = squadMap.get(g.grantId) ?? "Unknown";
    return { id: g.id, grantType: g.grantType, grantId: g.grantId, grantName };
  });

  return { userId, unrestricted: false, grants: enriched };
}

// GET /users/:id/access
router.get("/", requireAuth, requireAdmin, async (req, res) => {
  const userId = parseInt(req.params.id);
  if (isNaN(userId)) { res.status(400).json({ error: "Invalid ID" }); return; }
  res.json(await buildGrantResponse(userId));
});

// PUT /users/:id/access
// Body: { unrestricted: boolean, grants: { grantType, grantId }[] }
router.put("/", requireAuth, requireAdmin, async (req, res) => {
  const userId = parseInt(req.params.id);
  if (isNaN(userId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const { unrestricted, grants } = req.body as { unrestricted?: boolean; grants: { grantType: string; grantId: number }[] };
  if (!Array.isArray(grants)) { res.status(400).json({ error: "grants must be an array" }); return; }

  await db.delete(userAccessTable).where(eq(userAccessTable.userId, userId));

  if (unrestricted === true) {
    // No rows = unrestricted (natural state)
  } else {
    // Explicitly restricted
    const validTypes = ["level1", "level2", "squad"];
    const validGrants = grants.filter(g => validTypes.includes(g.grantType) && typeof g.grantId === "number");

    if (validGrants.length > 0) {
      await db.insert(userAccessTable).values(
        validGrants.map(g => ({ userId, grantType: g.grantType, grantId: g.grantId }))
      );
    } else {
      // Restricted to nothing — insert sentinel to persist this state
      await db.insert(userAccessTable).values({ userId, grantType: SENTINEL_TYPE, grantId: SENTINEL_ID });
    }
  }

  await logActivity(req, "user.access.updated", "user", userId, `Access grants updated for user ${userId}`);
  res.json(await buildGrantResponse(userId));
});

export default router;
