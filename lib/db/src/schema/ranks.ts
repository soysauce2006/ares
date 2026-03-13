import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const ranksTable = pgTable("ranks", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  abbreviation: text("abbreviation").notNull(),
  level: integer("level").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertRankSchema = createInsertSchema(ranksTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertRank = z.infer<typeof insertRankSchema>;
export type Rank = typeof ranksTable.$inferSelect;
