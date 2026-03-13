import { pgTable, text, serial, integer, timestamp, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const userAccessTable = pgTable("user_access", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "cascade" }).notNull(),
  grantType: text("grant_type").notNull(), // 'level1' | 'level2' | 'squad'
  grantId: integer("grant_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  unique("user_access_unique").on(t.userId, t.grantType, t.grantId),
]);

export type UserAccess = typeof userAccessTable.$inferSelect;
