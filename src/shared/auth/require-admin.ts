import type { FastifyRequest } from "fastify";
import type { JwtPayload } from "../../modules/auth/auth.types.js";
import { ForbiddenError } from "../errors/app-error.js";

export function requireAdmin(req: FastifyRequest): void {
  const payload = (req.user ?? null) as JwtPayload | null;
  if (!payload || payload.role !== "ADMIN") {
    throw new ForbiddenError({ message: "No autorizado" });
  }
}

