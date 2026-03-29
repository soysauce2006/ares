import { Router } from "express";
import { exec } from "child_process";
import { promisify } from "util";
import { db, siteSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../lib/auth.js";
import multer from "multer";
import AdmZip from "adm-zip";
import path from "path";
import fs from "fs";

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

// ── ZIP Package Upload ──────────────────────────────────────────────────────

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB max
});

function isZipBuffer(buf: Buffer): boolean {
  return buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04;
}

router.post(
  "/upload",
  requireAuth,
  requireAdmin,
  upload.single("package"),
  async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded. Use field name 'package'." });
      return;
    }

    if (!isZipBuffer(req.file.buffer)) {
      res.status(400).json({ error: "Uploaded file is not a valid ZIP archive." });
      return;
    }

    let zip: AdmZip;
    try {
      zip = new AdmZip(req.file.buffer);
    } catch (e: any) {
      res.status(400).json({ error: `Could not read ZIP: ${e.message}` });
      return;
    }

    const entries = zip.getEntries();

    // Detect if zip uses a "dist/" prefix
    const hasDistPrefix = entries.some(e => e.entryName === "dist/index.cjs" || e.entryName.startsWith("dist/public/"));
    const hasFlat = entries.some(e => e.entryName === "index.cjs");

    if (!hasDistPrefix && !hasFlat) {
      res.status(400).json({
        error: "Invalid package: ZIP must contain 'index.cjs' (or 'dist/index.cjs') at its root.",
      });
      return;
    }

    const distDir = path.resolve(process.cwd(), "dist");

    // Zip-slip protection — only allow index.cjs and public/**
    for (const entry of entries) {
      if (entry.isDirectory) continue;
      const rawName = entry.entryName;
      const relPath = hasDistPrefix ? rawName.replace(/^dist\//, "") : rawName;

      const resolved = path.resolve(distDir, relPath);
      if (!resolved.startsWith(distDir + path.sep) && resolved !== distDir) {
        res.status(400).json({ error: `Security violation: path traversal in '${rawName}'.` });
        return;
      }
      if (relPath !== "index.cjs" && !relPath.startsWith("public/")) {
        res.status(400).json({
          error: `Invalid package: unexpected file '${relPath}'. Only index.cjs and public/** are permitted.`,
        });
        return;
      }
    }

    // Backup current server bundle
    const serverPath = path.resolve(distDir, "index.cjs");
    const backupPath = path.resolve(distDir, "index.cjs.bak");
    try {
      if (fs.existsSync(serverPath)) {
        fs.copyFileSync(serverPath, backupPath);
      }
    } catch { /* non-fatal */ }

    // Clear old public dir so stale assets don't linger
    const publicDir = path.resolve(distDir, "public");
    try {
      if (fs.existsSync(publicDir)) {
        fs.rmSync(publicDir, { recursive: true, force: true });
      }
    } catch (e: any) {
      res.status(500).json({ error: `Failed to clear old public dir: ${e.message}` });
      return;
    }

    // Extract new files
    try {
      for (const entry of entries) {
        if (entry.isDirectory) continue;
        const rawName = entry.entryName;
        const relPath = hasDistPrefix ? rawName.replace(/^dist\//, "") : rawName;
        const targetPath = path.resolve(distDir, relPath);
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.writeFileSync(targetPath, entry.getData());
      }
    } catch (e: any) {
      // Attempt to restore backup
      try {
        if (fs.existsSync(backupPath)) fs.copyFileSync(backupPath, serverPath);
      } catch { /* best effort */ }
      res.status(500).json({ error: `Extraction failed: ${e.message}` });
      return;
    }

    res.json({
      success: true,
      message: "Update package applied. Server will restart in ~2 seconds.",
      filesExtracted: entries.filter(e => !e.isDirectory).length,
    });

    // Give the response time to flush, then restart
    setTimeout(() => process.exit(0), 2000);
  }
);

export default router;
