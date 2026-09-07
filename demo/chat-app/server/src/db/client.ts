import { PrismaClient } from "@prisma/client";

// Reuse a single PrismaClient instance (important with Bun's hot-reload dev server
// and to avoid exhausting Postgres connections under load).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
