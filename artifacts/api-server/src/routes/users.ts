import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateUserBody, UpdateUserBody, GetUserParams, UpdateUserParams, DeleteUserParams } from "@workspace/api-zod";
import { requireAuth, requireAdmin } from "../lib/auth.js";
import { logActivity } from "../lib/activity.js";

const router = Router();

function userToProfile(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    mfaEnabled: user.mfaEnabled,
    createdAt: user.createdAt.toISOString(),
    lastLogin: user.lastLogin?.toISOString() ?? null,
  };
}

router.get("/", requireAuth, requireAdmin, async (_req, res) => {
  const users = await db.select().from(usersTable).orderBy(usersTable.createdAt);
  res.json(users.map(userToProfile));
});

router.post("/", requireAuth, requireAdmin, async (req, res) => {
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", message: parsed.error.message });
    return;
  }
  const { username, email, password, role } = parsed.data;

  const existing = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);
  if (existing.length > 0) {
    res.status(400).json({ error: "Email already in use" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const [user] = await db
    .insert(usersTable)
    .values({ username, email, passwordHash, role: role as "admin" | "manager" | "viewer" })
    .returning();

  await logActivity(req, "user.created", "user", user.id, `Created user ${username}`);
  res.status(201).json(userToProfile(user));
});

router.get("/:id", requireAuth, requireAdmin, async (req, res) => {
  const parsed = GetUserParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  const users = await db.select().from(usersTable).where(eq(usersTable.id, parsed.data.id)).limit(1);
  if (!users[0]) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(userToProfile(users[0]));
});

router.put("/:id", requireAuth, requireAdmin, async (req, res) => {
  const paramParsed = UpdateUserParams.safeParse({ id: Number(req.params.id) });
  if (!paramParsed.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  const parsed = UpdateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.username) updates.username = parsed.data.username;
  if (parsed.data.email) updates.email = parsed.data.email;
  if (parsed.data.role) updates.role = parsed.data.role;
  if (parsed.data.password) updates.passwordHash = await bcrypt.hash(parsed.data.password, 12);
  updates.updatedAt = new Date();

  const [user] = await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, paramParsed.data.id))
    .returning();

  if (!user) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  await logActivity(req, "user.updated", "user", user.id, `Updated user ${user.username}`);
  res.json(userToProfile(user));
});

router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  const parsed = DeleteUserParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  const currentUser = (req as any).user;
  if (parsed.data.id === currentUser.id) {
    res.status(400).json({ error: "Cannot delete your own account" });
    return;
  }
  await db.delete(usersTable).where(eq(usersTable.id, parsed.data.id));
  await logActivity(req, "user.deleted", "user", parsed.data.id, `Deleted user ID ${parsed.data.id}`);
  res.json({ message: "User deleted" });
});

export default router;
