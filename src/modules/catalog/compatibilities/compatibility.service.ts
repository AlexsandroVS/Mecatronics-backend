import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { ConflictError, NotFoundError, ValidationError } from "../../../shared/errors/app-error.js";

export type CompatibilityItemDTO = Readonly<{
  id: number;
  skuInternal: string;
  name: string;
  kind: "MACHINE" | "PART" | "CONSUMABLE" | "ACCESSORY";
}>;

export class CompatibilityService {
  constructor(private readonly db: PrismaClient) {}

  async listForProduct(productId: number): Promise<{ machines: CompatibilityItemDTO[]; parts: CompatibilityItemDTO[] }> {
    const p = await this.db.product.findFirst({ where: { id: productId, deletedAt: null } as never });
    if (!p) throw new NotFoundError({ message: "Producto no encontrado" });

    const machines =
      p.kind === "MACHINE"
        ? []
        : await this.db.productCompatibility.findMany({
            where: { partId: productId, machine: { deletedAt: null } } as never,
            orderBy: [{ machine: { name: "asc" } }, { machineId: "asc" }],
            include: { machine: { select: { id: true, skuInternal: true, name: true, kind: true } } }
          });

    const parts =
      p.kind !== "MACHINE"
        ? []
        : await this.db.productCompatibility.findMany({
            where: { machineId: productId, part: { deletedAt: null } } as never,
            orderBy: [{ part: { name: "asc" } }, { partId: "asc" }],
            include: { part: { select: { id: true, skuInternal: true, name: true, kind: true } } }
          });

    return {
      machines: machines.map((x) => (x as unknown as { machine: CompatibilityItemDTO }).machine),
      parts: parts.map((x) => (x as unknown as { part: CompatibilityItemDTO }).part)
    };
  }

  async add(input: { partId: number; machineId: number }): Promise<void> {
    if (input.partId === input.machineId) throw new ValidationError({ message: "Producto inválido" });

    const [part, machine] = await Promise.all([
      this.db.product.findFirst({ where: { id: input.partId, deletedAt: null } as never }),
      this.db.product.findFirst({ where: { id: input.machineId, deletedAt: null } as never })
    ]);

    if (!part) throw new NotFoundError({ message: "Repuesto no encontrado" });
    if (!machine) throw new NotFoundError({ message: "Máquina no encontrada" });
    if (machine.kind !== "MACHINE") throw new ValidationError({ message: "machineId debe ser una maquinaria" });
    if (part.kind === "MACHINE") throw new ValidationError({ message: "partId no puede ser una maquinaria" });

    try {
      await this.db.productCompatibility.create({ data: { partId: input.partId, machineId: input.machineId } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictError({ message: "Compatibilidad ya existe" });
      }
      throw err;
    }
  }

  async remove(input: { partId: number; machineId: number }): Promise<void> {
    const res = await this.db.productCompatibility.deleteMany({ where: { partId: input.partId, machineId: input.machineId } });
    if (res.count === 0) throw new NotFoundError({ message: "Compatibilidad no encontrada" });
  }
}
