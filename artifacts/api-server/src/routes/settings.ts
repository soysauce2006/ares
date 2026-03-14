import { Router } from "express";
import { eq } from "drizzle-orm";
import multer from "multer";
import { db, siteSettingsTable } from "@workspace/db";
import { requireAuth, requireAdmin } from "../lib/auth.js";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
});

const TEXT_DEFAULTS: Record<string, string> = {
  siteName: "A.R.E.S.",
  siteSubtitle: "Advanced Roster Execution System",
  tier1Label: "Division",
  tier1LabelPlural: "Divisions",
  tier2Label: "Company",
  tier2LabelPlural: "Companies",
  tier3Label: "Squad",
  tier3LabelPlural: "Squads",
};

const IMAGE_KEYS = ["logoImage", "backgroundImage", "faviconImage"] as const;
const TEXT_KEYS = Object.keys(TEXT_DEFAULTS);

const DEFAULTS: Record<string, string> = {
  ...TEXT_DEFAULTS,
  logoImage: "",
  backgroundImage: "",
  faviconImage: "",
};

async function getSettingsMap(): Promise<Record<string, string>> {
  const rows = await db.select().from(siteSettingsTable);
  const map: Record<string, string> = { ...DEFAULTS };
  for (const row of rows) {
    map[row.key] = row.value;
  }
  return map;
}

router.get("/", async (_req, res) => {
  res.json(await getSettingsMap());
});

router.put("/", requireAuth, requireAdmin, async (req, res) => {
  const body = req.body as Record<string, string>;
  for (const key of TEXT_KEYS) {
    if (body[key] !== undefined) {
      const value = String(body[key]).trim() || TEXT_DEFAULTS[key];
      await db
        .insert(siteSettingsTable)
        .values({ key, value })
        .onConflictDoUpdate({ target: siteSettingsTable.key, set: { value, updatedAt: new Date() } });
    }
  }
  res.json(await getSettingsMap());
});

router.post(
  "/upload",
  requireAuth,
  requireAdmin,
  upload.single("file"),
  async (req, res) => {
    const key = req.body?.key as string;
    if (!IMAGE_KEYS.includes(key as any)) {
      res.status(400).json({ error: "Invalid image key. Use: logoImage, backgroundImage, or faviconImage" });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }
    const dataUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
    await db
      .insert(siteSettingsTable)
      .values({ key, value: dataUrl })
      .onConflictDoUpdate({ target: siteSettingsTable.key, set: { value: dataUrl, updatedAt: new Date() } });
    res.json({ key, url: dataUrl });
  }
);

router.delete("/upload/:key", requireAuth, requireAdmin, async (req, res) => {
  const key = req.params.key;
  if (!IMAGE_KEYS.includes(key as any)) {
    res.status(400).json({ error: "Invalid image key" });
    return;
  }
  await db.delete(siteSettingsTable).where(eq(siteSettingsTable.key, key));
  res.json({ key, message: "Image removed" });
});

export default router;
