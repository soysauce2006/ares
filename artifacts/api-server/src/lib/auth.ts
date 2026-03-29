import { db, sessionsTable, usersTable, mfaPendingTable, userPermissionsTable, customRolesTable } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";
import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

export async function createSession(userId: number, mfaVerified: boolean): Promise<string> {
  const sessionId = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  await db.insert(sessionsTable).values({ sessionId, userId, mfaVerified, expiresAt });
  return sessionId;
}

export async function getSession(sessionId: string) {
  const rows = await db
    .select()
    .from(sessionsTable)
    .where(and(eq(sessionsTable.sessionId, sessionId), gt(sessionsTable.expiresAt, new Date())))
    .limit(1);
  return rows[0] ?? null;
}

export async function deleteSession(sessionId: string) {
  await db.delete(sessionsTable).where(eq(sessionsTable.sessionId, sessionId));
}

export type PermFlag =
  | "canManageRoster"
  | "canManageOrg"
  | "canManageChannels"
  | "canViewActivity"
  | "canManageUsers";

async function loadPermissions(userId: number) {
  const rows = await db
    .select()
    .from(userPermissionsTable)
    .where(eq(userPermissionsTable.userId, userId))
    .limit(1);
  return rows[0] ?? null;
}

async function loadCustomRolePerms(customRoleId: number | null) {
  if (!customRoleId) return null;
  const rows = await db
    .select()
    .from(customRolesTable)
    .where(eq(customRolesTable.id, customRoleId))
    .limit(1);
  return rows[0] ?? null;
}

export function hasPerm(req: Request, flag: PermFlag): boolean {
  const user = (req as any).user;
  if (user?.role === "admin") return true;
  const perms = (req as any).permissions;
  if (perms?.[flag]) return true;
  const rolePerms = (req as any).customRolePerms;
  if (rolePerms?.[flag]) return true;
  return false;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const sessionId = req.cookies?.["session_id"];
  if (!sessionId) {
    res.status(401).json({ error: "Unauthorized", message: "Not logged in" });
    return;
  }
  const session = await getSession(sessionId);
  if (!session || !session.userId) {
    res.status(401).json({ error: "Unauthorized", message: "Session expired" });
    return;
  }

  const users = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, session.userId))
    .limit(1);
  const user = users[0];
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (user.mfaEnabled && !session.mfaVerified) {
    res.status(401).json({ error: "MFA_REQUIRED", message: "MFA verification required" });
    return;
  }

  const [permissions, customRolePerms] = await Promise.all([
    loadPermissions(user.id),
    loadCustomRolePerms((user as any).customRoleId ?? null),
  ]);

  (req as any).user = user;
  (req as any).session = session;
  (req as any).permissions = permissions;
  (req as any).customRolePerms = customRolePerms;
  next();
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (user?.role !== "admin") {
    res.status(403).json({ error: "Forbidden", message: "Admin access required" });
    return;
  }
  next();
}

export async function requireManagerOrAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (user?.role === "admin" || user?.role === "manager") {
    next();
    return;
  }
  const perms = (req as any).permissions;
  const rolePerms = (req as any).customRolePerms;
  if (perms?.canManageRoster || perms?.canManageOrg || rolePerms?.canManageRoster || rolePerms?.canManageOrg) {
    next();
    return;
  }
  res.status(403).json({ error: "Forbidden", message: "Manager or admin access required" });
}

export function requireAdminOrPerm(flag: PermFlag) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (hasPerm(req, flag)) {
      next();
    } else {
      res.status(403).json({ error: "Forbidden", message: "Insufficient permissions" });
    }
  };
}

export async function createMfaPendingToken(userId: number): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
  await db.insert(mfaPendingTable).values({ token, userId, expiresAt });
  return token;
}

export async function getMfaPendingToken(token: string) {
  const rows = await db
    .select()
    .from(mfaPendingTable)
    .where(and(eq(mfaPendingTable.token, token), gt(mfaPendingTable.expiresAt, new Date())))
    .limit(1);
  return rows[0] ?? null;
}

export async function deleteMfaPendingToken(token: string) {
  await db.delete(mfaPendingTable).where(eq(mfaPendingTable.token, token));
}
