import { Router } from "express";
import bcrypt from "bcryptjs";
import speakeasy from "speakeasy";
import qrcode from "qrcode";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  RegisterBody,
  LoginBody,
  VerifyMfaBody,
  ConfirmMfaBody,
} from "@workspace/api-zod";
import {
  createSession,
  getSession,
  deleteSession,
  requireAuth,
  createMfaPendingToken,
  getMfaPendingToken,
  deleteMfaPendingToken,
} from "../lib/auth.js";
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

router.post("/register", async (req, res) => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", message: parsed.error.message });
    return;
  }
  const { username, email, password } = parsed.data;

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

  // First user becomes admin
  const allUsers = await db.select({ id: usersTable.id }).from(usersTable).limit(1);
  const role = allUsers.length === 0 ? "admin" : "viewer";

  const [user] = await db
    .insert(usersTable)
    .values({ username, email, passwordHash, role: role as "admin" | "viewer" | "manager" })
    .returning();

  const sessionId = await createSession(user.id, true);
  res.cookie("session_id", sessionId, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  await logActivity(req, "user.registered", "user", user.id, `User ${username} registered`);

  res.status(201).json({ user: userToProfile(user), message: "Registered successfully" });
});

router.post("/login", async (req, res) => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  const { email, password } = parsed.data;

  const users = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);
  const user = users[0];

  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    await logActivity(req, "auth.login.failed", "user", user.id, `Failed login for ${email}`);
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  if (user.mfaEnabled) {
    const mfaToken = await createMfaPendingToken(user.id);
    res.json({ requiresMfa: true, mfaToken, message: "MFA verification required" });
    return;
  }

  const sessionId = await createSession(user.id, true);
  res.cookie("session_id", sessionId, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  await db.update(usersTable).set({ lastLogin: new Date() }).where(eq(usersTable.id, user.id));
  await logActivity(req, "auth.login.success", "user", user.id, `User ${user.username} logged in`);

  res.json({ requiresMfa: false, user: userToProfile(user) });
});

router.post("/verify-mfa", async (req, res) => {
  const parsed = VerifyMfaBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  const { mfaToken, code } = parsed.data;

  const pending = await getMfaPendingToken(mfaToken);
  if (!pending || !pending.userId) {
    res.status(401).json({ error: "Invalid or expired MFA token" });
    return;
  }

  const users = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, pending.userId))
    .limit(1);
  const user = users[0];
  if (!user || !user.mfaSecret) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  const verified = speakeasy.totp.verify({
    secret: user.mfaSecret,
    encoding: "base32",
    token: code,
    window: 2,
  });

  if (!verified) {
    // check backup codes
    const backupCodes = user.backupCodes ?? [];
    const backupIndex = backupCodes.indexOf(code);
    if (backupIndex === -1) {
      res.status(401).json({ error: "Invalid MFA code" });
      return;
    }
    // consume backup code
    const newCodes = backupCodes.filter((_, i) => i !== backupIndex);
    await db.update(usersTable).set({ backupCodes: newCodes }).where(eq(usersTable.id, user.id));
  }

  await deleteMfaPendingToken(mfaToken);

  const sessionId = await createSession(user.id, true);
  res.cookie("session_id", sessionId, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  await db.update(usersTable).set({ lastLogin: new Date() }).where(eq(usersTable.id, user.id));
  await logActivity(req, "auth.mfa.verified", "user", user.id, `MFA verified for ${user.username}`);

  res.json({ user: userToProfile(user), message: "MFA verified" });
});

router.post("/setup-mfa", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const secret = speakeasy.generateSecret({ name: `RosterApp:${user.email}` });
  const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url!);

  res.json({ secret: secret.base32, qrCodeUrl });
});

router.post("/confirm-mfa", requireAuth, async (req, res) => {
  const parsed = ConfirmMfaBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  const { code, secret } = parsed.data;
  const user = (req as any).user;

  const verified = speakeasy.totp.verify({
    secret,
    encoding: "base32",
    token: code,
    window: 2,
  });

  if (!verified) {
    res.status(400).json({ error: "Invalid verification code" });
    return;
  }

  // Generate backup codes
  const { v4: uuidv4 } = await import("uuid");
  const backupCodes = Array.from({ length: 8 }, () => uuidv4().replace(/-/g, "").substring(0, 10));

  await db
    .update(usersTable)
    .set({ mfaEnabled: true, mfaSecret: secret, backupCodes })
    .where(eq(usersTable.id, user.id));

  await logActivity(req, "auth.mfa.enabled", "user", user.id, `MFA enabled for ${user.username}`);

  res.json({ message: "MFA enabled successfully" });
});

router.post("/logout", async (req, res) => {
  const sessionId = req.cookies?.["session_id"];
  if (sessionId) {
    await deleteSession(sessionId);
  }
  res.clearCookie("session_id");
  res.json({ message: "Logged out" });
});

router.get("/me", requireAuth, async (req, res) => {
  const user = (req as any).user;
  res.json(userToProfile(user));
});

export default router;
