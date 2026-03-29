import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const channelsTable = pgTable("channels", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  createdById: integer("created_by_id").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const channelMembersTable = pgTable("channel_members", {
  id: serial("id").primaryKey(),
  channelId: integer("channel_id")
    .references(() => channelsTable.id, { onDelete: "cascade" })
    .notNull(),
  userId: integer("user_id")
    .references(() => usersTable.id, { onDelete: "cascade" })
    .notNull(),
  addedAt: timestamp("added_at").defaultNow().notNull(),
});

export const channelMessagesTable = pgTable("channel_messages", {
  id: serial("id").primaryKey(),
  channelId: integer("channel_id")
    .references(() => channelsTable.id, { onDelete: "cascade" })
    .notNull(),
  senderId: integer("sender_id")
    .references(() => usersTable.id, { onDelete: "cascade" })
    .notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Channel = typeof channelsTable.$inferSelect;
export type ChannelMember = typeof channelMembersTable.$inferSelect;
export type ChannelMessage = typeof channelMessagesTable.$inferSelect;
