import { Router } from "express";
import { db, rosterTable, ranksTable, squadsTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import {
  CreateMemberBody,
  UpdateMemberBody,
  GetMemberParams,
  UpdateMemberParams,
  DeleteMemberParams,
} from "@workspace/api-zod";
import { requireAuth, requireManagerOrAdmin } from "../lib/auth.js";
import { logActivity } from "../lib/activity.js";
import { getUserAccess, AccessFilter } from "../lib/access.js";

const router = Router();

async function getMemberWithDetails(id: number) {
  const rows = await db
    .select({
      member: rosterTable,
      rank: ranksTable,
      squad: squadsTable,
    })
    .from(rosterTable)
    .leftJoin(ranksTable, eq(rosterTable.rankId, ranksTable.id))
    .leftJoin(squadsTable, eq(rosterTable.squadId, squadsTable.id))
    .where(eq(rosterTable.id, id))
    .limit(1);
  return rows[0] ?? null;
}

function formatMember(row: { member: typeof rosterTable.$inferSelect; rank: typeof ranksTable.$inferSelect | null; squad: typeof squadsTable.$inferSelect | null }) {
  return {
    id: row.member.id,
    username: row.member.username,
    displayName: row.member.displayName ?? null,
    rankId: row.member.rankId ?? null,
    rankName: row.rank?.name ?? null,
    rankAbbreviation: row.rank?.abbreviation ?? null,
    squadId: row.member.squadId ?? null,
    squadName: row.squad?.name ?? null,
    status: row.member.status,
    notes: row.member.notes ?? null,
    joinedAt: row.member.joinedAt.toISOString(),
    updatedAt: row.member.updatedAt.toISOString(),
  };
}

function canAccessSquad(squadId: number | null | undefined, access: AccessFilter): boolean {
  if (access.unrestricted) return true;
  if (squadId === null || squadId === undefined) return false;
  return access.squadIds.includes(squadId);
}

// GET /roster — filtered by user's accessible squads
router.get("/", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const access = await getUserAccess(user.id, user.role);

  let query = db
    .select({
      member: rosterTable,
      rank: ranksTable,
      squad: squadsTable,
    })
    .from(rosterTable)
    .leftJoin(ranksTable, eq(rosterTable.rankId, ranksTable.id))
    .leftJoin(squadsTable, eq(rosterTable.squadId, squadsTable.id))
    .$dynamic();

  if (!access.unrestricted && access.squadIds.length > 0) {
    query = query.where(inArray(rosterTable.squadId, access.squadIds));
  } else if (!access.unrestricted && access.squadIds.length === 0) {
    res.json([]);
    return;
  }

  const rows = await query.orderBy(rosterTable.username);
  res.json(rows.map(formatMember));
});

// POST /roster — restricted to squads the user can access
router.post("/", requireAuth, requireManagerOrAdmin, async (req, res) => {
  const parsed = CreateMemberBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", message: parsed.error.message });
    return;
  }

  const user = (req as any).user;
  const access = await getUserAccess(user.id, user.role);

  if (!canAccessSquad(parsed.data.squadId ?? null, access)) {
    res.status(403).json({ error: "Forbidden", message: "You do not have access to that squad." });
    return;
  }

  const [member] = await db
    .insert(rosterTable)
    .values({
      username: parsed.data.username,
      displayName: parsed.data.displayName ?? null,
      rankId: parsed.data.rankId ?? null,
      squadId: parsed.data.squadId ?? null,
      status: (parsed.data.status as "active" | "inactive" | "suspended") ?? "active",
      notes: parsed.data.notes ?? null,
    })
    .returning();

  await logActivity(req, "roster.member.added", "roster", member.id, `Added member ${member.username}`);

  const row = await getMemberWithDetails(member.id);
  if (!row) {
    res.status(500).json({ error: "Failed to fetch created member" });
    return;
  }
  res.status(201).json(formatMember(row));
});

// GET /roster/:id — only accessible if member is in user's scope
router.get("/:id", requireAuth, async (req, res) => {
  const parsed = GetMemberParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  const row = await getMemberWithDetails(parsed.data.id);
  if (!row) {
    res.status(404).json({ error: "Member not found" });
    return;
  }

  const user = (req as any).user;
  const access = await getUserAccess(user.id, user.role);
  if (!canAccessSquad(row.member.squadId, access)) {
    res.status(403).json({ error: "Forbidden", message: "You do not have access to this member." });
    return;
  }

  res.json(formatMember(row));
});

// PUT /roster/:id — must have access to the member's current squad AND the new squad (if changing)
router.put("/:id", requireAuth, requireManagerOrAdmin, async (req, res) => {
  const paramParsed = UpdateMemberParams.safeParse({ id: Number(req.params.id) });
  if (!paramParsed.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  const parsed = UpdateMemberBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const existing = await getMemberWithDetails(paramParsed.data.id);
  if (!existing) {
    res.status(404).json({ error: "Member not found" });
    return;
  }

  const user = (req as any).user;
  const access = await getUserAccess(user.id, user.role);

  if (!canAccessSquad(existing.member.squadId, access)) {
    res.status(403).json({ error: "Forbidden", message: "You do not have access to this member." });
    return;
  }

  const newSquadId = "squadId" in parsed.data ? (parsed.data.squadId ?? null) : existing.member.squadId;
  if (!canAccessSquad(newSquadId, access)) {
    res.status(403).json({ error: "Forbidden", message: "You do not have access to the target squad." });
    return;
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.username !== undefined) updates.username = parsed.data.username;
  if (parsed.data.displayName !== undefined) updates.displayName = parsed.data.displayName;
  if ("rankId" in parsed.data) updates.rankId = parsed.data.rankId ?? null;
  if ("squadId" in parsed.data) updates.squadId = parsed.data.squadId ?? null;
  if (parsed.data.status !== undefined) updates.status = parsed.data.status;
  if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes;

  const [member] = await db
    .update(rosterTable)
    .set(updates)
    .where(eq(rosterTable.id, paramParsed.data.id))
    .returning();

  if (!member) {
    res.status(404).json({ error: "Member not found" });
    return;
  }

  await logActivity(req, "roster.member.updated", "roster", member.id, `Updated member ${member.username}`);

  const row = await getMemberWithDetails(member.id);
  if (!row) {
    res.status(500).json({ error: "Failed to fetch updated member" });
    return;
  }
  res.json(formatMember(row));
});

// DELETE /roster/:id — must have access to the member's squad
router.delete("/:id", requireAuth, requireManagerOrAdmin, async (req, res) => {
  const parsed = DeleteMemberParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  const rows = await db.select().from(rosterTable).where(eq(rosterTable.id, parsed.data.id)).limit(1);
  const member = rows[0];
  if (!member) {
    res.status(404).json({ error: "Member not found" });
    return;
  }

  const user = (req as any).user;
  const access = await getUserAccess(user.id, user.role);
  if (!canAccessSquad(member.squadId, access)) {
    res.status(403).json({ error: "Forbidden", message: "You do not have access to this member." });
    return;
  }

  await db.delete(rosterTable).where(eq(rosterTable.id, parsed.data.id));
  await logActivity(req, "roster.member.removed", "roster", parsed.data.id, `Removed member ${member.username}`);
  res.json({ message: "Member removed from roster" });
});

export default router;
