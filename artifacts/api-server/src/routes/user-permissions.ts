import { Router } from "express";
import { db, userPermissionsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../lib/auth.js";
import { logActivity } from "../lib/activity.js";

const router = Router({ mergeParams: true });

// GET /api/users/:id/permissions
router.get("/", requireAuth, requireAdmin, async (req, res) => {
  const userId = Number((req.params as any).id);
  if (isNaN(userId)) { res.status(400).json({ error: "Invalid user id" }); return; }

  const user = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user[0]) { res.status(404).json({ error: "User not found" }); return; }

  const rows = await db.select().from(userPermissionsTable).where(eq(userPermissionsTable.userId, userId)).limit(1);

  if (!rows[0]) {
    res.json({
      userId,
      canManageRoster: false,
      canManageOrg: false,
      canManageChannels: false,
      canViewActivity: false,
      canManageUsers: false,
    });
    return;
  }

  const p = rows[0];
  res.json({
    userId: p.userId,
    canManageRoster: p.canManageRoster,
    canManageOrg: p.canManageOrg,
    canManageChannels: p.canManageChannels,
    canViewActivity: p.canViewActivity,
    canManageUsers: p.canManageUsers,
  });
});

// PUT /api/users/:id/permissions
router.put("/", requireAuth, requireAdmin, async (req, res) => {
  const userId = Number((req.params as any).id);
  if (isNaN(userId)) { res.status(400).json({ error: "Invalid user id" }); return; }

  const user = await db.select({ id: usersTable.id, role: usersTable.role }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user[0]) { res.status(404).json({ error: "User not found" }); return; }

  const {
    canManageRoster = false,
    canManageOrg = false,
    canManageChannels = false,
    canViewActivity = false,
    canManageUsers = false,
  } = req.body as {
    canManageRoster?: boolean;
    canManageOrg?: boolean;
    canManageChannels?: boolean;
    canViewActivity?: boolean;
    canManageUsers?: boolean;
  };

  const existing = await db.select({ id: userPermissionsTable.id }).from(userPermissionsTable).where(eq(userPermissionsTable.userId, userId)).limit(1);

  if (existing[0]) {
    await db
      .update(userPermissionsTable)
      .set({ canManageRoster, canManageOrg, canManageChannels, canViewActivity, canManageUsers, updatedAt: new Date() })
      .where(eq(userPermissionsTable.userId, userId));
  } else {
    await db
      .insert(userPermissionsTable)
      .values({ userId, canManageRoster, canManageOrg, canManageChannels, canViewActivity, canManageUsers });
  }

  await logActivity(req, "user.permissions_updated", "user", userId, `Updated permissions for user ${userId}`);

  res.json({ userId, canManageRoster, canManageOrg, canManageChannels, canViewActivity, canManageUsers });
});

export default router;
