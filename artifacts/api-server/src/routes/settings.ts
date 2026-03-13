import { Router } from "express";
import { db, siteSettingsTable } from "@workspace/db";
import { requireAuth, requireAdmin } from "../lib/auth.js";

const router = Router();

const DEFAULTS: Record<string, string> = {
  siteName: "A.R.E.S.",
  siteSubtitle: "Advanced Roster Execution System",
  tier1Label: "Division",
  tier1LabelPlural: "Divisions",
  tier2Label: "Company",
  tier2LabelPlural: "Companies",
  tier3Label: "Squad",
  tier3LabelPlural: "Squads",
};

const KEYS = Object.keys(DEFAULTS);

async function getSettingsMap(): Promise<Record<string, string>> {
  const rows = await db.select().from(siteSettingsTable);
  const map: Record<string, string> = { ...DEFAULTS };
  for (const row of rows) {
    map[row.key] = row.value;
  }
  return map;
}

router.get("/", async (req, res) => {
  const map = await getSettingsMap();
  res.json(map);
});

router.put("/", requireAuth, requireAdmin, async (req, res) => {
  const body = req.body as Record<string, string>;
  for (const key of KEYS) {
    if (body[key] !== undefined) {
      const value = String(body[key]).trim() || DEFAULTS[key];
      await db
        .insert(siteSettingsTable)
        .values({ key, value })
        .onConflictDoUpdate({ target: siteSettingsTable.key, set: { value, updatedAt: new Date() } });
    }
  }
  const map = await getSettingsMap();
  res.json(map);
});

export default router;
