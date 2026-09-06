import { common } from "./utils";
import { users } from "./users";
import { boolean, jsonb, pgTable, text, varchar } from "drizzle-orm/pg-core";

export const notifications = pgTable("notifications", {
  ...common,
  userId: varchar("user_id", { length: 64 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  actorId: varchar("actor_id", { length: 64 }).references(() => users.id),
  type: varchar("type", { length: 50 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  body: text("body").notNull(),
  link: text("link"),
  isRead: boolean("is_read").default(false).notNull(),
  metadata: jsonb("metadata").default({}),
});
