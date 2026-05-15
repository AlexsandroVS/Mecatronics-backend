import type { Prisma, PrismaClient } from "@prisma/client";

export type UserCreateInput = Readonly<{
  email: string;
  passwordHash: string;
  role: "ADMIN" | "STAFF";
}>;

export type UserUpdateInput = Readonly<{
  email?: string;
  passwordHash?: string;
  role?: "ADMIN" | "STAFF";
}>;

export class UserRepository {
  constructor(private readonly db: PrismaClient) {}

  list(): Promise<Array<{ id: number; email: string; role: "ADMIN" | "STAFF"; createdAt: Date }>> {
    return this.db.user.findMany({
      orderBy: [{ role: "asc" }, { email: "asc" }, { id: "asc" }],
      select: { id: true, email: true, role: true, createdAt: true }
    }) as never;
  }

  getById(id: number): Promise<{ id: number; email: string; role: "ADMIN" | "STAFF"; createdAt: Date; passwordHash: string } | null> {
    return this.db.user.findUnique({ where: { id }, select: { id: true, email: true, role: true, createdAt: true, passwordHash: true } }) as never;
  }

  create(input: UserCreateInput): Promise<{ id: number; email: string; role: "ADMIN" | "STAFF"; createdAt: Date }> {
    return this.db.user.create({
      data: { email: input.email, passwordHash: input.passwordHash, role: input.role } satisfies Prisma.UserCreateInput,
      select: { id: true, email: true, role: true, createdAt: true }
    }) as never;
  }

  update(id: number, input: UserUpdateInput): Promise<{ id: number; email: string; role: "ADMIN" | "STAFF"; createdAt: Date }> {
    return this.db.user.update({
      where: { id },
      data: { email: input.email, passwordHash: input.passwordHash, role: input.role },
      select: { id: true, email: true, role: true, createdAt: true }
    }) as never;
  }

  delete(id: number): Promise<{ id: number }> {
    return this.db.user.delete({ where: { id }, select: { id: true } });
  }
}

