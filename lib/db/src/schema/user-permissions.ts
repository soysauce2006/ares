import { pgTable, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const userPermissionsTable = pgTable("user_permissions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique().references(() => usersTable.id, { onDelete: "cascade" }),
  canManageRoster: boolean("can_manage_roster").notNull().default(false),
  canManageOrg: boolean("can_manage_org").notNull().default(false),
  canManageChannels: boolean("can_manage_channels").notNull().default(false),
  canViewActivity: boolean("can_view_activity").notNull().default(false),
  canManageUsers: boolean("can_manage_users").notNull().default(false),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type UserPermissions = typeof userPermissionsTable.$inferSelect;
