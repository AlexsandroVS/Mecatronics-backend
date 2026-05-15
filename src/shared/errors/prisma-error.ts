import { Prisma } from "@prisma/client";
import { ConflictError, NotFoundError, ValidationError } from "./app-error.js";

export function throwIfPrismaError(err: unknown): never | void {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      throw new ConflictError({ message: "Conflicto por unicidad" });
    }
    if (err.code === "P2003") {
      throw new ValidationError({ message: "Referencia inválida" });
    }
    if (err.code === "P2025") {
      throw new NotFoundError({ message: "Recurso no encontrado" });
    }
  }
}

