import { Router } from "express";
import { db, messagesTable, usersTable } from "@workspace/db";
import { eq, or, and, isNull, inArray, desc, gt, lt, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { logActivity } from "../lib/activity.js";

const router = Router();

function getSessionUser(req: any) {
  return req.session?.userId as number | undefined;
}

// GET /api/messages/unread — count of unread DMs for the current user
router.get("/unread", requireAuth, async (req, res) => {
  const userId = getSessionUser(req)!;
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(messagesTable)
    .where(and(eq(messagesTable.recipientId, userId), isNull(messagesTable.readAt)));
  res.json({ count: rows[0]?.count ?? 0 });
});

// GET /api/messages/conversations — list of users who have DM'd the current user (or vice versa)
router.get("/conversations", requireAuth, async (req, res) => {
  const userId = getSessionUser(req)!;

  // Get all distinct user ids that are in a DM thread with current user
  const sent = await db
    .selectDistinct({ otherId: messagesTable.recipientId })
    .from(messagesTable)
    .where(and(eq(messagesTable.senderId, userId), sql`${messagesTable.recipientId} IS NOT NULL`));
  const received = await db
    .selectDistinct({ otherId: messagesTable.senderId })
    .from(messagesTable)
    .where(and(eq(messagesTable.recipientId, userId)));

  const otherIds = [...new Set([
    ...sent.map(r => r.otherId!),
    ...received.map(r => r.otherId),
  ])].filter(id => id !== userId);

  if (otherIds.length === 0) {
    res.json([]);
    return;
  }

  const users = await db
    .select({ id: usersTable.id, username: usersTable.username })
    .from(usersTable)
    .where(inArray(usersTable.id, otherIds));

  // Get unread count per conversation
  const unreadRows = await db
    .select({
      senderId: messagesTable.senderId,
      count: sql<number>`count(*)::int`,
    })
    .from(messagesTable)
    .where(and(eq(messagesTable.recipientId, userId), isNull(messagesTable.readAt), inArray(messagesTable.senderId, otherIds)))
    .groupBy(messagesTable.senderId);

  const unreadMap = new Map(unreadRows.map(r => [r.senderId, r.count]));

  res.json(users.map(u => ({ ...u, unread: unreadMap.get(u.id) ?? 0 })));
});

// GET /api/messages/global?before=<id>&limit=50 — global channel messages
router.get("/global", requireAuth, async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const before = req.query.before ? parseInt(req.query.before as string) : undefined;

  const conditions = [isNull(messagesTable.recipientId)];
  if (before) conditions.push(lt(messagesTable.id, before));

  const rows = await db
    .select({
      id: messagesTable.id,
      content: messagesTable.content,
      createdAt: messagesTable.createdAt,
      senderId: messagesTable.senderId,
      senderUsername: usersTable.username,
    })
    .from(messagesTable)
    .innerJoin(usersTable, eq(messagesTable.senderId, usersTable.id))
    .where(and(...conditions))
    .orderBy(desc(messagesTable.id))
    .limit(limit);

  res.json(rows.reverse());
});

// GET /api/messages/since/:lastId — poll for new global messages after lastId
router.get("/since/:lastId", requireAuth, async (req, res) => {
  const lastId = parseInt(req.params.lastId);
  const userId = getSessionUser(req)!;

  const globalNew = await db
    .select({
      id: messagesTable.id,
      content: messagesTable.content,
      createdAt: messagesTable.createdAt,
      senderId: messagesTable.senderId,
      recipientId: messagesTable.recipientId,
      senderUsername: usersTable.username,
    })
    .from(messagesTable)
    .innerJoin(usersTable, eq(messagesTable.senderId, usersTable.id))
    .where(
      and(
        gt(messagesTable.id, lastId),
        or(
          isNull(messagesTable.recipientId),
          eq(messagesTable.recipientId, userId),
          eq(messagesTable.senderId, userId),
        )
      )
    )
    .orderBy(messagesTable.id)
    .limit(100);

  res.json(globalNew);
});

// GET /api/messages/direct/:userId — DM thread with a specific user
router.get("/direct/:userId", requireAuth, async (req, res) => {
  const userId = getSessionUser(req)!;
  const otherId = parseInt(req.params.userId);
  if (isNaN(otherId)) { res.status(400).json({ error: "Invalid user ID" }); return; }

  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const before = req.query.before ? parseInt(req.query.before as string) : undefined;

  const conditions = [
    or(
      and(eq(messagesTable.senderId, userId), eq(messagesTable.recipientId, otherId)),
      and(eq(messagesTable.senderId, otherId), eq(messagesTable.recipientId, userId)),
    )!,
  ];
  if (before) conditions.push(lt(messagesTable.id, before));

  const rows = await db
    .select({
      id: messagesTable.id,
      content: messagesTable.content,
      createdAt: messagesTable.createdAt,
      senderId: messagesTable.senderId,
      recipientId: messagesTable.recipientId,
      senderUsername: usersTable.username,
    })
    .from(messagesTable)
    .innerJoin(usersTable, eq(messagesTable.senderId, usersTable.id))
    .where(and(...conditions))
    .orderBy(desc(messagesTable.id))
    .limit(limit);

  // Mark received messages as read
  const unreadIds = rows.filter(r => r.senderId === otherId && r.recipientId === userId).map(r => r.id);
  if (unreadIds.length > 0) {
    await db.update(messagesTable).set({ readAt: new Date() }).where(inArray(messagesTable.id, unreadIds));
  }

  res.json(rows.reverse());
});

// POST /api/messages — send a message
router.post("/", requireAuth, async (req, res) => {
  const userId = getSessionUser(req)!;
  const { recipientId, content } = req.body as { recipientId?: number | null; content: string };

  if (!content || typeof content !== "string" || content.trim().length === 0) {
    res.status(400).json({ error: "Content required" });
    return;
  }
  if (content.length > 2000) {
    res.status(400).json({ error: "Message too long (max 2000 chars)" });
    return;
  }

  const [msg] = await db.insert(messagesTable).values({
    senderId: userId,
    recipientId: recipientId ?? null,
    content: content.trim(),
  }).returning();

  const [sender] = await db.select({ username: usersTable.username }).from(usersTable).where(eq(usersTable.id, userId));

  res.status(201).json({ ...msg, senderUsername: sender.username });
});

// GET /api/messages/users — list all users for starting DMs (excluding self)
router.get("/users", requireAuth, async (req, res) => {
  const userId = getSessionUser(req)!;
  const users = await db
    .select({ id: usersTable.id, username: usersTable.username })
    .from(usersTable)
    .where(sql`${usersTable.id} != ${userId}`)
    .orderBy(usersTable.username);
  res.json(users);
});

export default router;
