import type { InventoryMovement, InventoryMovementType, Prisma, PrismaClient } from "@prisma/client";

export type InventoryMovementCreateInput = Readonly<{
  productId: number;
  type: InventoryMovementType;
  quantity: number;
  stockBefore: number;
  stockAfter: number;
  referenceDoc?: string | null;
  actorUserId?: number | null;
}>;

export type InventoryMovementReportRow = Readonly<{
  id: number;
  productId: number;
  type: InventoryMovementType;
  quantity: number;
  stockBefore: number;
  stockAfter: number;
  referenceDoc: string | null;
  createdAt: Date;
  actorUser: { id: number; email: string } | null;
  product: { id: number; skuInternal: string; name: string };
}>;

export class InventoryMovementRepository {
  constructor(private readonly db: PrismaClient | Prisma.TransactionClient) {}

  latestByProductId(productId: number): Promise<Pick<InventoryMovement, "stockAfter"> | null> {
    return this.db.inventoryMovement.findFirst({
      where: { productId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { stockAfter: true }
    });
  }

  create(input: InventoryMovementCreateInput): Promise<InventoryMovement> {
    return this.db.inventoryMovement.create({
      data: {
        productId: input.productId,
        type: input.type,
        quantity: input.quantity,
        stockBefore: input.stockBefore,
        stockAfter: input.stockAfter,
        referenceDoc: input.referenceDoc ?? null,
        actorUserId: input.actorUserId ?? null
      } as never
    });
  }

  listByProductId(input: { productId: number; limit: number; offset: number; dateFrom?: Date; dateTo?: Date }) {
    const where: Prisma.InventoryMovementWhereInput = {
      productId: input.productId,
      ...(input.dateFrom || input.dateTo
        ? {
            createdAt: {
              ...(input.dateFrom ? { gte: input.dateFrom } : {}),
              ...(input.dateTo ? { lte: input.dateTo } : {})
            }
          }
        : {}),
      product: { deletedAt: null } as never
    };

    return this.db.inventoryMovement.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: input.offset,
      take: input.limit,
      include: { actorUser: { select: { id: true, email: true } } } as never
    });
  }

  listGlobal(input: { limit: number; offset: number; dateFrom?: Date; dateTo?: Date }) {
    const where: Prisma.InventoryMovementWhereInput = {
      ...(input.dateFrom || input.dateTo
        ? {
            createdAt: {
              ...(input.dateFrom ? { gte: input.dateFrom } : {}),
              ...(input.dateTo ? { lte: input.dateTo } : {})
            }
          }
        : {}),
      product: { deletedAt: null } as never
    };

    return this.db.inventoryMovement.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: input.offset,
      take: input.limit,
      include: {
        actorUser: { select: { id: true, email: true } },
        product: { select: { id: true, skuInternal: true, name: true } }
      } as never
    });
  }

  listForReport(input: { limit: number; productId?: number; dateFrom?: Date; dateTo?: Date }) {
    const where: Prisma.InventoryMovementWhereInput = {
      ...(input.productId ? { productId: input.productId } : {}),
      ...(input.dateFrom || input.dateTo
        ? {
            createdAt: {
              ...(input.dateFrom ? { gte: input.dateFrom } : {}),
              ...(input.dateTo ? { lte: input.dateTo } : {})
            }
          }
        : {}),
      product: { deletedAt: null } as never
    };

    return this.db.inventoryMovement.findMany({
      where,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: input.limit,
      include: {
        actorUser: { select: { id: true, email: true } },
        product: { select: { id: true, skuInternal: true, name: true } }
      } as never
    });
  }
}
