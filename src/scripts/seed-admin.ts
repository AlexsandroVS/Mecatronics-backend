import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../shared/db/prisma.js";
import { env } from "../config/env.js";

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const found = process.argv.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : undefined;
}

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

const parsed = schema.safeParse({
  email: readArg("email") ?? env.adminEmail,
  password: readArg("password") ?? env.adminPassword
});

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
  throw new Error(`Seed inválido: ${issues}`);
}

const hash = await bcrypt.hash(parsed.data.password, 10);

const user = await prisma().user.upsert({
  where: { email: parsed.data.email },
  update: { passwordHash: hash, role: "ADMIN" },
  create: { email: parsed.data.email, passwordHash: hash, role: "ADMIN" },
  select: { id: true, email: true, role: true }
});

process.stdout.write(JSON.stringify(user) + "\n");
await prisma().$disconnect();

