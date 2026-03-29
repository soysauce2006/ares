import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const customRolesTable = pgTable("custom_roles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  color: text("color").notNull().default("#6B7280"),
  canManageRoster: boolean("can_manage_roster").notNull().default(false),
  canManageOrg: boolean("can_manage_org").notNull().default(false),
  canManageChannels: boolean("can_manage_channels").notNull().default(false),
  canViewActivity: boolean("can_view_activity").notNull().default(false),
  canManageUsers: boolean("can_manage_users").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type CustomRole = typeof customRolesTable.$inferSelect;
