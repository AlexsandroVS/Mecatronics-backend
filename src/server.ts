import { createApp } from "./app.js";
import { env } from "./config/env.js";
import bcrypt from "bcryptjs";
import { prisma } from "./shared/db/prisma.js";

const app = createApp();

async function ensureDevAdminUser() {
  if (process.env.NODE_ENV === "production") return;
  if (!env.adminEmail || !env.adminPassword) return;

  const hash = await bcrypt.hash(env.adminPassword, 10);
  await prisma().user.upsert({
    where: { email: env.adminEmail },
    update: { passwordHash: hash, role: "ADMIN" },
    create: { email: env.adminEmail, passwordHash: hash, role: "ADMIN" }
  });
}

await ensureDevAdminUser();

try {
  await app.listen({ port: env.port, host: "0.0.0.0" });
} catch (err) {
  app.log.error({ err }, "Failed to start server");
  process.exit(1);
}
