

// drop complete table

import { db } from "./src/db";
import { eq } from "drizzle-orm";
import {
  conversations,
  conversationMembers,
  messages,
  notifications,
  refreshTokens,
  users,
} from "./src/db/schemas";

async function dropAllTables() {
  try {
    await db.delete(conversations);
    await db.delete(conversationMembers);
    await db.delete(messages);
    await db.delete(notifications);
    await db.delete(refreshTokens);
    await db.delete(users);
    console.log("All tables dropped successfully");
  } catch (error) {
    console.error("Failed to drop tables", error);
  }
}

dropAllTables();