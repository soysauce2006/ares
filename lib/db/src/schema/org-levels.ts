import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const orgLevel1Table = pgTable("org_level1", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const orgLevel2Table = pgTable("org_level2", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  level1Id: integer("level1_id").references(() => orgLevel1Table.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertOrgLevel1Schema = createInsertSchema(orgLevel1Table).omit({ id: true, createdAt: true, updatedAt: true });
export const insertOrgLevel2Schema = createInsertSchema(orgLevel2Table).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertOrgLevel1 = z.infer<typeof insertOrgLevel1Schema>;
export type InsertOrgLevel2 = z.infer<typeof insertOrgLevel2Schema>;
export type OrgLevel1 = typeof orgLevel1Table.$inferSelect;
export type OrgLevel2 = typeof orgLevel2Table.$inferSelect;
