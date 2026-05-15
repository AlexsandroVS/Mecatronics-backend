import { PrismaClient } from "@prisma/client";
import { env } from "../../config/env.js";

declare global {
  var __prisma: PrismaClient | undefined;
}

export function prisma(): PrismaClient {
  if (globalThis.__prisma) return globalThis.__prisma;

  const client = new PrismaClient({
    datasourceUrl: env.databaseUrl
  });

  globalThis.__prisma = client;
  return client;
}
