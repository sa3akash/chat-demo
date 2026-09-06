import { boolean, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { common } from "./utils";
import { userStatusEnum } from "./enum";




// --- Tables ---
export const users = pgTable("users", {
  ...common,
  email: varchar("email", { length: 255 }).notNull(),
  username: varchar("username", { length: 100 }).notNull(),
  phone: varchar("phone", { length: 50 }),
  passwordHash: text("password_hash"),
  isVerified: boolean("is_verified").default(false).notNull(),
  twoFactorEnabled: boolean("two_factor_enabled").default(false).notNull(),
  twoFactorSecret: text("two_factor_secret"),
  status: userStatusEnum("status").default("offline").notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
});


export const refreshTokens = pgTable("refresh_tokens", {
  ...common,
  userId: varchar("user_id", { length: 64 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  userAgent: text("user_agent").notNull(),
  ipAddress: varchar("ip_address", { length: 45 }).notNull(),
  fingerprint: varchar("fingerprint", { length: 255 }).notNull(),
});