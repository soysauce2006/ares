import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable, clearanceLevelsTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { CreateUserBody, UpdateUserBody, GetUserParams, UpdateUserParams, DeleteUserParams } from "@workspace/api-zod";
import { requireAuth, requireAdmin } from "../lib/auth.js";
import { logActivity } from "../lib/activity.js";

const router = Router();

async function usersWithClearance(userRows: (typeof usersTable.$inferSelect)[]) {
  const clearanceIds = [...new Set(userRows.map(u => u.clearanceId).filter((id): id is number => id !== null))];
  const clearances = clearanceIds.length > 0
    ? await db.select().from(clearanceLevelsTable).where(inArray(clearanceLevelsTable.id, clearanceIds))
    : [];
  const clearanceMap = new Map(clearances.map(c => [c.id, c]));

  return userRows.map(user => {
    const cl = user.clearanceId ? clearanceMap.get(user.clearanceId) : undefined;
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      clearanceId: user.clearanceId ?? null,
      clearanceName: cl?.name ?? null,
      clearanceLevel: cl?.level ?? null,
      clearanceColor: cl?.color ?? null,
      mfaEnabled: user.mfaEnabled,
      mustChangePassword: user.mustChangePassword,
      createdAt: user.createdAt.toISOString(),
      lastLogin: user.lastLogin?.toISOString() ?? null,
    };
  });
}

async function userToProfile(user: typeof usersTable.$inferSelect) {
  const [profile] = await usersWithClearance([user]);
  return profile;
}

router.get("/", requireAuth, requireAdmin, async (_req, res) => {
  const users = await db.select().from(usersTable).orderBy(usersTable.createdAt);
  res.json(await usersWithClearance(users));
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
  res.status(201).json(await userToProfile(user));
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
  res.json(await userToProfile(users[0]));
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

  // Support clearanceId directly from req.body (not in generated schema but we read it here)
  const rawBody = req.body as any;
  if ("clearanceId" in rawBody) {
    updates.clearanceId = rawBody.clearanceId === null || rawBody.clearanceId === "" ? null : Number(rawBody.clearanceId) || null;
  }

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
  res.json(await userToProfile(user));
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
