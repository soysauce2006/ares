import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const squadsTable = pgTable("squads", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertSquadSchema = createInsertSchema(squadsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSquad = z.infer<typeof insertSquadSchema>;
export type Squad = typeof squadsTable.$inferSelect;
