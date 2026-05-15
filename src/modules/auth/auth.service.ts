import type { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { UnauthorizedError } from "../../shared/errors/app-error.js";

export class AuthService {
  constructor(private readonly db: PrismaClient) {}

  async login(input: { email: string; password: string }): Promise<{ id: number; email: string; role: UserRole }> {
    const user = await this.db.user.findUnique({
      where: { email: input.email },
      select: { id: true, email: true, passwordHash: true, role: true }
    });

    if (!user) throw new UnauthorizedError({ message: "Credenciales inválidas" });

    const ok = await bcrypt.compare(input.password, user.passwordHash);
    if (!ok) throw new UnauthorizedError({ message: "Credenciales inválidas" });

    return { id: user.id, email: user.email, role: user.role };
  }
}

