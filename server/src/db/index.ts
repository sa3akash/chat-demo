import { logger } from "@/lib/logger";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const connectionString =
  process.env.DATABASE_URL || "postgresql://admin:admin@localhost:5432/testing";

const pool = new Pool({
  connectionString: connectionString,
});

export const db = drizzle({
  client: pool,
});


pool.on("connect", () => {
  logger.info("Connected to database");
});

pool.on("error", (error) => {
  logger.error(error, "Database connection error");
});


export async function dbConnect() {
  try {
    await pool.query("SELECT 1");
    logger.info("Database connected successfully");
  } catch (error) {
    logger.error(error, "Failed to connect to database");
  }
}

export async function dbDisconnect() {
  try {
    await pool.end();
    logger.info("Database disconnected successfully");
  } catch (error) {
    logger.error(error, "Failed to disconnect from database");
  }
}