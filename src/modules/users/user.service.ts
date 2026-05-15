import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { ConflictError, NotFoundError } from "../../shared/errors/app-error.js";
import { throwIfPrismaError } from "../../shared/errors/prisma-error.js";
import { toUserDTO } from "./user.mapper.js";
import { UserRepository } from "./user.repository.js";

export class UserService {
  private readonly repo: UserRepository;

  constructor(private readonly db: PrismaClient) {
    this.repo = new UserRepository(db);
  }

  async list() {
    const users = await this.repo.list();
    return users.map(toUserDTO);
  }

  async create(input: { email: string; password: string; role: "ADMIN" | "STAFF" }) {
    try {
      const passwordHash = await bcrypt.hash(input.password, 10);
      const created = await this.repo.create({ email: input.email, passwordHash, role: input.role });
      return toUserDTO(created);
    } catch (err) {
      throwIfPrismaError(err);
      throw err;
    }
  }

  async update(id: number, input: { email?: string; password?: string; role?: "ADMIN" | "STAFF" }) {
    const existing = await this.repo.getById(id);
    if (!existing) throw new NotFoundError({ message: "Usuario no encontrado" });

    if (input.role && existing.role === "ADMIN" && input.role !== "ADMIN") {
      const all = await this.repo.list();
      const adminCount = all.filter((u) => u.role === "ADMIN").length;
      if (adminCount <= 1) {
        throw new ConflictError({ message: "Debe existir al menos 1 admin" });
      }
    }

    try {
      const passwordHash = input.password ? await bcrypt.hash(input.password, 10) : undefined;
      const updated = await this.repo.update(id, { email: input.email, passwordHash, role: input.role });
      return toUserDTO(updated);
    } catch (err) {
      throwIfPrismaError(err);
      throw err;
    }
  }

  async delete(id: number) {
    const existing = await this.repo.getById(id);
    if (!existing) throw new NotFoundError({ message: "Usuario no encontrado" });
    if (existing.role === "ADMIN") {
      const all = await this.repo.list();
      const adminCount = all.filter((u) => u.role === "ADMIN").length;
      if (adminCount <= 1) {
        throw new ConflictError({ message: "No se puede eliminar el último admin" });
      }
    }
    try {
      await this.repo.delete(id);
    } catch (err) {
      throwIfPrismaError(err);
      throw err;
    }
  }
}

