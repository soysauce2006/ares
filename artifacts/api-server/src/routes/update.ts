import { Router } from "express";
import { exec } from "child_process";
import { promisify } from "util";
import { db, siteSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../lib/auth.js";

const execAsync = promisify(exec);
const router = Router();

async function getSetting(key: string): Promise<string> {
  const rows = await db
    .select()
    .from(siteSettingsTable)
    .where(eq(siteSettingsTable.key, key));
  return rows[0]?.value ?? "";
}

async function setSetting(key: string, value: string) {
  await db
    .insert(siteSettingsTable)
    .values({ key, value })
    .onConflictDoUpdate({
      target: siteSettingsTable.key,
      set: { value, updatedAt: new Date() },
    });
}

router.get("/config", requireAuth, requireAdmin, async (_req, res) => {
  const gitRepo = await getSetting("gitRepo");
  const gitBranch = (await getSetting("gitBranch")) || "main";
  res.json({ gitRepo, gitBranch });
});

router.put("/config", requireAuth, requireAdmin, async (req, res) => {
  const { gitRepo, gitBranch } = req.body as { gitRepo?: string; gitBranch?: string };
  if (typeof gitRepo === "string") await setSetting("gitRepo", gitRepo.trim());
  if (typeof gitBranch === "string")
    await setSetting("gitBranch", gitBranch.trim() || "main");
  res.json({
    gitRepo: await getSetting("gitRepo"),
    gitBranch: (await getSetting("gitBranch")) || "main",
  });
});

router.get("/status", requireAuth, requireAdmin, async (_req, res) => {
  const gitRepo = await getSetting("gitRepo");
  const gitBranch = (await getSetting("gitBranch")) || "main";
  const currentCommit = process.env.GIT_COMMIT || "unknown";

  if (!gitRepo) {
    res.json({
      currentCommit,
      latestCommit: null,
      updateAvailable: false,
      gitRepo,
      gitBranch,
      error: null,
    });
    return;
  }

  try {
    const { stdout } = await execAsync(
      `git ls-remote "${gitRepo}" "refs/heads/${gitBranch}"`,
      {
        timeout: 15000,
        env: {
          ...process.env,
          GIT_SSL_NO_VERIFY: "1",
          GIT_TERMINAL_PROMPT: "0",
        },
      }
    );
    const latestCommit = stdout.split("\t")[0]?.trim() || null;
    const updateAvailable =
      !!latestCommit &&
      currentCommit !== "unknown" &&
      latestCommit !== currentCommit;
    res.json({
      currentCommit,
      latestCommit,
      updateAvailable,
      gitRepo,
      gitBranch,
      error: null,
    });
  } catch (err: any) {
    res.json({
      currentCommit,
      latestCommit: null,
      updateAvailable: false,
      gitRepo,
      gitBranch,
      error: String(err.message ?? err),
    });
  }
});

export default router;
