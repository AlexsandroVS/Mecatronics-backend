import bcrypt from "bcryptjs";
import { z } from "zod";
import { env } from "../config/env.js";
import { prisma } from "../shared/db/prisma.js";

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const found = process.argv.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : undefined;
}

const schema = z.object({
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8),
  staffEmail: z.string().email(),
  staffPassword: z.string().min(8)
});

const parsed = schema.safeParse({
  adminEmail: readArg("adminEmail") ?? env.adminEmail,
  adminPassword: readArg("adminPassword") ?? env.adminPassword,
  staffEmail: readArg("staffEmail") ?? env.staffEmail,
  staffPassword: readArg("staffPassword") ?? env.staffPassword
});

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
  throw new Error(`Seed inválido: ${issues}`);
}

const db = prisma();

const adminHash = await bcrypt.hash(parsed.data.adminPassword, 10);
const staffHash = await bcrypt.hash(parsed.data.staffPassword, 10);

const admin = await db.user.upsert({
  where: { email: parsed.data.adminEmail },
  update: { passwordHash: adminHash, role: "ADMIN" },
  create: { email: parsed.data.adminEmail, passwordHash: adminHash, role: "ADMIN" },
  select: { id: true, email: true, role: true }
});

const staff = await db.user.upsert({
  where: { email: parsed.data.staffEmail },
  update: { passwordHash: staffHash, role: "STAFF" },
  create: { email: parsed.data.staffEmail, passwordHash: staffHash, role: "STAFF" },
  select: { id: true, email: true, role: true }
});

process.stdout.write(JSON.stringify({ admin, staff }) + "\n");
await db.$disconnect();

