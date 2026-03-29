import { Router } from "express";
import { db, channelsTable, channelMembersTable, channelMessagesTable, usersTable, rosterTable } from "@workspace/db";
import { eq, and, inArray, desc, gt, sql } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../lib/auth.js";
import { logActivity } from "../lib/activity.js";

const router = Router();

function sessionUser(req: any): number {
  return req.session?.userId as number;
}

async function isMember(channelId: number, userId: number): Promise<boolean> {
  const rows = await db
    .select({ id: channelMembersTable.id })
    .from(channelMembersTable)
    .where(and(eq(channelMembersTable.channelId, channelId), eq(channelMembersTable.userId, userId)))
    .limit(1);
  return rows.length > 0;
}

// GET /api/channels — list channels current user is a member of (admin sees all)
router.get("/", requireAuth, async (req, res) => {
  const userId = sessionUser(req);
  const user = (req as any).user;

  let channels;
  if (user?.role === "admin") {
    channels = await db.select().from(channelsTable).orderBy(channelsTable.name);
  } else {
    const memberships = await db
      .select({ channelId: channelMembersTable.channelId })
      .from(channelMembersTable)
      .where(eq(channelMembersTable.userId, userId));
    const ids = memberships.map((m) => m.channelId);
    if (ids.length === 0) { res.json([]); return; }
    channels = await db
      .select()
      .from(channelsTable)
      .where(inArray(channelsTable.id, ids))
      .orderBy(channelsTable.name);
  }

  const channelIds = channels.map((c) => c.id);
  const memberCounts =
    channelIds.length > 0
      ? await db
          .select({
            channelId: channelMembersTable.channelId,
            count: sql<number>`count(*)::int`,
          })
          .from(channelMembersTable)
          .where(inArray(channelMembersTable.channelId, channelIds))
          .groupBy(channelMembersTable.channelId)
      : [];

  const countMap = new Map(memberCounts.map((r) => [r.channelId, r.count]));

  res.json(
    channels.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      memberCount: countMap.get(c.id) ?? 0,
      createdAt: c.createdAt.toISOString(),
    }))
  );
});

// POST /api/channels — create channel (admin only)
router.post("/", requireAuth, requireAdmin, async (req, res) => {
  const userId = sessionUser(req);
  const { name, description, memberUserIds, clearanceLevelId, rankId } = req.body as {
    name: string;
    description?: string;
    memberUserIds?: number[];
    clearanceLevelId?: number;
    rankId?: number;
  };

  if (!name || typeof name !== "string" || name.trim().length < 2) {
    res.status(400).json({ error: "Channel name must be at least 2 characters" });
    return;
  }

  const [channel] = await db
    .insert(channelsTable)
    .values({ name: name.trim(), description: description?.trim() || null, createdById: userId })
    .returning();

  // Resolve membership
  const userIdsToAdd = new Set<number>(memberUserIds ?? []);

  // Add by clearance level
  if (clearanceLevelId) {
    const usersWithClearance = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.clearanceId, clearanceLevelId));
    usersWithClearance.forEach((u) => userIdsToAdd.add(u.id));
  }

  // Add by rank — join roster username → user id
  if (rankId) {
    const usersWithRank = await db
      .select({ id: usersTable.id })
      .from(rosterTable)
      .innerJoin(usersTable, eq(rosterTable.username, usersTable.username))
      .where(eq(rosterTable.rankId, rankId));
    usersWithRank.forEach((r) => userIdsToAdd.add(r.id));
  }

  // Always add the creator
  userIdsToAdd.add(userId);

  if (userIdsToAdd.size > 0) {
    await db.insert(channelMembersTable).values(
      [...userIdsToAdd].map((uid) => ({ channelId: channel.id, userId: uid }))
    );
  }

  await logActivity(req, "channel.created", "channel", channel.id, `Created channel "${channel.name}"`);

  res.status(201).json({
    id: channel.id,
    name: channel.name,
    description: channel.description,
    memberCount: userIdsToAdd.size,
    createdAt: channel.createdAt.toISOString(),
  });
});

// PUT /api/channels/:id — update channel (admin only)
router.put("/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const { name, description } = req.body as { name?: string; description?: string };
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (name !== undefined) updates.name = name.trim();
  if (description !== undefined) updates.description = description?.trim() || null;

  const [row] = await db
    .update(channelsTable)
    .set(updates)
    .where(eq(channelsTable.id, id))
    .returning();
  if (!row) { res.status(404).json({ error: "Channel not found" }); return; }

  await logActivity(req, "channel.updated", "channel", id, `Updated channel "${row.name}"`);
  res.json({ id: row.id, name: row.name, description: row.description });
});

// DELETE /api/channels/:id — delete channel (admin only)
router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [row] = await db.delete(channelsTable).where(eq(channelsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Channel not found" }); return; }

  await logActivity(req, "channel.deleted", "channel", id, `Deleted channel "${row.name}"`);
  res.json({ message: "Deleted" });
});

// GET /api/channels/:id/members — list channel members
router.get("/:id/members", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const userId = sessionUser(req);
  const user = (req as any).user;
  if (user?.role !== "admin" && !(await isMember(id, userId))) {
    res.status(403).json({ error: "Not a member" }); return;
  }

  const members = await db
    .select({
      id: usersTable.id,
      username: usersTable.username,
      email: usersTable.email,
      role: usersTable.role,
      addedAt: channelMembersTable.addedAt,
    })
    .from(channelMembersTable)
    .innerJoin(usersTable, eq(channelMembersTable.userId, usersTable.id))
    .where(eq(channelMembersTable.channelId, id))
    .orderBy(usersTable.username);

  res.json(members.map((m) => ({ ...m, addedAt: m.addedAt.toISOString() })));
});

// POST /api/channels/:id/members — add members (admin only)
router.post("/:id/members", requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const { userIds, clearanceLevelId, rankId } = req.body as {
    userIds?: number[];
    clearanceLevelId?: number;
    rankId?: number;
  };

  const toAdd = new Set<number>(userIds ?? []);

  if (clearanceLevelId) {
    const rows = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.clearanceId, clearanceLevelId));
    rows.forEach((r) => toAdd.add(r.id));
  }

  if (rankId) {
    const rows = await db
      .select({ id: usersTable.id })
      .from(rosterTable)
      .innerJoin(usersTable, eq(rosterTable.username, usersTable.username))
      .where(eq(rosterTable.rankId, rankId));
    rows.forEach((r) => toAdd.add(r.id));
  }

  if (toAdd.size === 0) {
    res.status(400).json({ error: "No users specified" }); return;
  }

  // Get existing members to avoid duplicate inserts
  const existing = await db
    .select({ userId: channelMembersTable.userId })
    .from(channelMembersTable)
    .where(eq(channelMembersTable.channelId, id));
  const existingIds = new Set(existing.map((e) => e.userId));
  const newIds = [...toAdd].filter((uid) => !existingIds.has(uid));

  if (newIds.length > 0) {
    await db
      .insert(channelMembersTable)
      .values(newIds.map((uid) => ({ channelId: id, userId: uid })));
  }

  res.json({ added: newIds.length });
});

// DELETE /api/channels/:id/members/:userId — remove member (admin only)
router.delete("/:id/members/:userId", requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  const uid = parseInt(req.params.userId);
  if (isNaN(id) || isNaN(uid)) { res.status(400).json({ error: "Invalid ID" }); return; }

  await db
    .delete(channelMembersTable)
    .where(and(eq(channelMembersTable.channelId, id), eq(channelMembersTable.userId, uid)));

  res.json({ message: "Removed" });
});

// GET /api/channels/:id/messages?before=<id>&limit=50
router.get("/:id/messages", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const userId = sessionUser(req);
  const user = (req as any).user;
  if (user?.role !== "admin" && !(await isMember(id, userId))) {
    res.status(403).json({ error: "Not a member" }); return;
  }

  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const before = req.query.before ? parseInt(req.query.before as string) : undefined;

  const rows = await db
    .select({
      id: channelMessagesTable.id,
      channelId: channelMessagesTable.channelId,
      content: channelMessagesTable.content,
      createdAt: channelMessagesTable.createdAt,
      senderId: channelMessagesTable.senderId,
      senderUsername: usersTable.username,
    })
    .from(channelMessagesTable)
    .innerJoin(usersTable, eq(channelMessagesTable.senderId, usersTable.id))
    .where(
      before
        ? and(eq(channelMessagesTable.channelId, id), sql`${channelMessagesTable.id} < ${before}`)
        : eq(channelMessagesTable.channelId, id)
    )
    .orderBy(desc(channelMessagesTable.id))
    .limit(limit);

  res.json(rows.reverse().map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })));
});

// GET /api/channels/:id/messages/since/:lastId
router.get("/:id/messages/since/:lastId", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  const lastId = parseInt(req.params.lastId);
  if (isNaN(id) || isNaN(lastId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const userId = sessionUser(req);
  const user = (req as any).user;
  if (user?.role !== "admin" && !(await isMember(id, userId))) {
    res.status(403).json({ error: "Not a member" }); return;
  }

  const rows = await db
    .select({
      id: channelMessagesTable.id,
      channelId: channelMessagesTable.channelId,
      content: channelMessagesTable.content,
      createdAt: channelMessagesTable.createdAt,
      senderId: channelMessagesTable.senderId,
      senderUsername: usersTable.username,
    })
    .from(channelMessagesTable)
    .innerJoin(usersTable, eq(channelMessagesTable.senderId, usersTable.id))
    .where(and(eq(channelMessagesTable.channelId, id), gt(channelMessagesTable.id, lastId)))
    .orderBy(channelMessagesTable.id);

  res.json(rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })));
});

// DELETE /api/channels/:id/messages/:msgId — delete a channel message (admin or own)
router.delete("/:id/messages/:msgId", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id as string);
  const msgId = parseInt(req.params.msgId as string);
  if (isNaN(id) || isNaN(msgId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const userId = sessionUser(req);
  const user = (req as any).user;

  const [msg] = await db
    .select()
    .from(channelMessagesTable)
    .where(and(eq(channelMessagesTable.id, msgId), eq(channelMessagesTable.channelId, id)))
    .limit(1);

  if (!msg) { res.status(404).json({ error: "Message not found" }); return; }

  if (user?.role !== "admin" && msg.senderId !== userId) {
    res.status(403).json({ error: "Cannot delete another user's message" }); return;
  }

  await db.delete(channelMessagesTable).where(eq(channelMessagesTable.id, msgId));
  await logActivity(req, "channel.message.deleted", "channel", id, `Deleted message ${msgId} from channel ${id}`);
  res.json({ message: "Deleted" });
});

// DELETE /api/channels/:id/messages/clear — clear all messages in a channel (admin only)
router.delete("/:id/messages/clear", requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const result = await db
    .delete(channelMessagesTable)
    .where(eq(channelMessagesTable.channelId, id))
    .returning({ id: channelMessagesTable.id });

  await logActivity(req, "channel.messages.cleared", "channel", id, `Cleared all messages in channel ${id} (${result.length} messages)`);
  res.json({ deleted: result.length });
});

// POST /api/channels/:id/messages — send message
router.post("/:id/messages", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const userId = sessionUser(req);
  const user = (req as any).user;
  if (user?.role !== "admin" && !(await isMember(id, userId))) {
    res.status(403).json({ error: "Not a member" }); return;
  }

  const { content } = req.body as { content: string };
  if (!content || typeof content !== "string" || content.trim().length === 0) {
    res.status(400).json({ error: "Content required" }); return;
  }
  if (content.length > 2000) {
    res.status(400).json({ error: "Message too long (max 2000 chars)" }); return;
  }

  const [msg] = await db
    .insert(channelMessagesTable)
    .values({ channelId: id, senderId: userId, content: content.trim() })
    .returning();

  const [sender] = await db
    .select({ username: usersTable.username })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  res.status(201).json({ ...msg, senderUsername: sender.username, createdAt: msg.createdAt.toISOString() });
});

export default router;
