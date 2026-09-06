import { createId } from "@paralleldrive/cuid2";
import { timestamp, varchar } from "drizzle-orm/pg-core";

export const common = {
  id: varchar("id")
    .$defaultFn(() => createId())
    .primaryKey(),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),

  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
};