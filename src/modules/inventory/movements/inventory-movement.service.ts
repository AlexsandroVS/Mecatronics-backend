import type { InventoryMovementType, PrismaClient } from "@prisma/client";
import { ConflictError, NotFoundError } from "../../../shared/errors/app-error.js";
import { throwIfPrismaError } from "../../../shared/errors/prisma-error.js";
import { toInventoryMovementDTO } from "./inventory-movement.mapper.js";
import { movementDelta } from "./inventory-movement.domain.js";
import { InventoryMovementRepository, type InventoryMovementReportRow } from "./inventory-movement.repository.js";
import type { InventoryMovementGlobalDTO } from "./inventory-movement.types.js";

export class InventoryMovementService {
  private readonly repo: InventoryMovementRepository;

  constructor(private readonly db: PrismaClient) {
    this.repo = new InventoryMovementRepository(db);
  }

  async create(input: {
    productId: number;
    type: InventoryMovementType;
    quantity: number;
    referenceDoc?: string | null;
    actorUserId?: number | null;
  }) {
    try {
      const created = await this.db.$transaction(async (tx) => {
        const product = await tx.product.findFirst({
          where: { id: input.productId, deletedAt: null } as never,
          select: { id: true, currentStock: true }
        });
        if (!product) throw new NotFoundError({ message: "Producto no encontrado" });

        const repo = new InventoryMovementRepository(tx);
        const currentStock = product.currentStock;
        const delta = movementDelta(input.type, input.quantity);
        const nextStock = currentStock + delta;

        if (nextStock < 0) throw new ConflictError({ message: "Stock insuficiente" });

        const movement = await repo.create({
          productId: input.productId,
          type: input.type,
          quantity: input.quantity,
          stockBefore: currentStock,
          stockAfter: nextStock,
          referenceDoc: input.referenceDoc ?? null,
          actorUserId: input.actorUserId ?? null
        });

        await tx.product.update({ where: { id: input.productId }, data: { currentStock: nextStock } });
        return movement;
      });

      return toInventoryMovementDTO(created as never);
    } catch (err) {
      throwIfPrismaError(err);
      throw err;
    }
  }

  async listByProductId(input: { productId: number; limit: number; offset: number; dateFrom?: Date; dateTo?: Date }) {
    const items = await this.repo.listByProductId(input);
    return items.map((m) => toInventoryMovementDTO(m as never));
  }

  async listGlobal(input: { limit: number; offset: number; dateFrom?: Date; dateTo?: Date }): Promise<InventoryMovementGlobalDTO[]> {
    const items = await this.repo.listGlobal(input);
    return items.map((m) => ({
      ...toInventoryMovementDTO(m as never),
      product: (m as unknown as InventoryMovementReportRow).product
    }));
  }

  async listForReport(input: { limit: number; productId?: number; dateFrom?: Date; dateTo?: Date }): Promise<InventoryMovementReportRow[]> {
    const items = await this.repo.listForReport(input);
    return items as unknown as InventoryMovementReportRow[];
  }
}
