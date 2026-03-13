import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";

export const clearanceLevelsTable = pgTable("clearance_levels", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  level: integer("level").notNull(),
  description: text("description"),
  color: text("color").notNull().default("amber"),
  permissionLevel: text("permission_level"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type ClearanceLevel = typeof clearanceLevelsTable.$inferSelect;
