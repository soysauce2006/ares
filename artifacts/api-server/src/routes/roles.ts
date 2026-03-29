import { Router } from "express";
import { db, customRolesTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../lib/auth.js";
import { logActivity } from "../lib/activity.js";

const router = Router();

// GET /api/roles — list all custom roles (admin only)
router.get("/", requireAuth, requireAdmin, async (_req, res) => {
  const roles = await db.select().from(customRolesTable).orderBy(customRolesTable.name);
  res.json(roles.map(r => ({
    id: r.id,
    name: r.name,
    description: r.description,
    color: r.color,
    canManageRoster: r.canManageRoster,
    canManageOrg: r.canManageOrg,
    canManageChannels: r.canManageChannels,
    canViewActivity: r.canViewActivity,
    canManageUsers: r.canManageUsers,
    createdAt: r.createdAt.toISOString(),
  })));
});

// POST /api/roles — create a custom role (admin only)
router.post("/", requireAuth, requireAdmin, async (req, res) => {
  const {
    name, description, color = "#6B7280",
    canManageRoster = false, canManageOrg = false,
    canManageChannels = false, canViewActivity = false, canManageUsers = false,
  } = req.body as {
    name: string; description?: string; color?: string;
    canManageRoster?: boolean; canManageOrg?: boolean;
    canManageChannels?: boolean; canViewActivity?: boolean; canManageUsers?: boolean;
  };

  if (!name || typeof name !== "string" || name.trim().length < 1) {
    res.status(400).json({ error: "Role name is required" });
    return;
  }

  try {
    const [role] = await db.insert(customRolesTable).values({
      name: name.trim(), description: description?.trim() || null, color,
      canManageRoster, canManageOrg, canManageChannels, canViewActivity, canManageUsers,
    }).returning();

    await logActivity(req, "role.created", "role", role.id, `Created custom role "${role.name}"`);
    res.status(201).json({ id: role.id, name: role.name, description: role.description, color: role.color, canManageRoster: role.canManageRoster, canManageOrg: role.canManageOrg, canManageChannels: role.canManageChannels, canViewActivity: role.canViewActivity, canManageUsers: role.canManageUsers, createdAt: role.createdAt.toISOString() });
  } catch (err: any) {
    if (err.code === "23505") { res.status(409).json({ error: "A role with that name already exists" }); return; }
    throw err;
  }
});

// PUT /api/roles/:id — update a custom role (admin only)
router.put("/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = Number((req.params as any).id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid role id" }); return; }

  const {
    name, description, color,
    canManageRoster, canManageOrg, canManageChannels, canViewActivity, canManageUsers,
  } = req.body as {
    name?: string; description?: string; color?: string;
    canManageRoster?: boolean; canManageOrg?: boolean;
    canManageChannels?: boolean; canViewActivity?: boolean; canManageUsers?: boolean;
  };

  const existing = await db.select().from(customRolesTable).where(eq(customRolesTable.id, id)).limit(1);
  if (!existing[0]) { res.status(404).json({ error: "Role not found" }); return; }

  const updates: Record<string, any> = { updatedAt: new Date() };
  if (name !== undefined) updates.name = name.trim();
  if (description !== undefined) updates.description = description?.trim() || null;
  if (color !== undefined) updates.color = color;
  if (canManageRoster !== undefined) updates.canManageRoster = canManageRoster;
  if (canManageOrg !== undefined) updates.canManageOrg = canManageOrg;
  if (canManageChannels !== undefined) updates.canManageChannels = canManageChannels;
  if (canViewActivity !== undefined) updates.canViewActivity = canViewActivity;
  if (canManageUsers !== undefined) updates.canManageUsers = canManageUsers;

  try {
    const [updated] = await db.update(customRolesTable).set(updates).where(eq(customRolesTable.id, id)).returning();
    await logActivity(req, "role.updated", "role", id, `Updated custom role "${updated.name}"`);
    res.json({ id: updated.id, name: updated.name, description: updated.description, color: updated.color, canManageRoster: updated.canManageRoster, canManageOrg: updated.canManageOrg, canManageChannels: updated.canManageChannels, canViewActivity: updated.canViewActivity, canManageUsers: updated.canManageUsers, createdAt: updated.createdAt.toISOString() });
  } catch (err: any) {
    if (err.code === "23505") { res.status(409).json({ error: "A role with that name already exists" }); return; }
    throw err;
  }
});

// DELETE /api/roles/:id — delete a custom role (admin only)
router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = Number((req.params as any).id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid role id" }); return; }

  const existing = await db.select().from(customRolesTable).where(eq(customRolesTable.id, id)).limit(1);
  if (!existing[0]) { res.status(404).json({ error: "Role not found" }); return; }

  // Unassign all users that had this role
  await db.update(usersTable).set({ customRoleId: null }).where(eq(usersTable.customRoleId, id));
  await db.delete(customRolesTable).where(eq(customRolesTable.id, id));

  await logActivity(req, "role.deleted", "role", id, `Deleted custom role "${existing[0].name}"`);
  res.json({ success: true });
});

export default router;
