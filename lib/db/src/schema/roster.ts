import { pgTable, text, serial, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { ranksTable } from "./ranks";
import { squadsTable } from "./squads";

export const memberStatusEnum = pgEnum("member_status", ["active", "inactive", "suspended"]);

export const rosterTable = pgTable("roster", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  displayName: text("display_name"),
  rankId: integer("rank_id").references(() => ranksTable.id, { onDelete: "set null" }),
  squadId: integer("squad_id").references(() => squadsTable.id, { onDelete: "set null" }),
  status: memberStatusEnum("status").notNull().default("active"),
  notes: text("notes"),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertRosterSchema = createInsertSchema(rosterTable).omit({
  id: true,
  joinedAt: true,
  updatedAt: true,
});

export type InsertRosterMember = z.infer<typeof insertRosterSchema>;
export type RosterMember = typeof rosterTable.$inferSelect;
