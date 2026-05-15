import type { InventoryMovementDTO } from "./inventory-movement.types.js";

type InventoryMovementLike = Readonly<{
  id: number;
  productId: number;
  type: InventoryMovementDTO["type"];
  quantity: number;
  stockBefore: number;
  stockAfter: number;
  referenceDoc: string | null;
  createdAt: Date;
  actorUser?: { id: number; email: string } | null;
}>;

export function toInventoryMovementDTO(m: InventoryMovementLike): InventoryMovementDTO {
  return {
    id: m.id,
    productId: m.productId,
    type: m.type,
    quantity: m.quantity,
    stockBefore: m.stockBefore,
    stockAfter: m.stockAfter,
    referenceDoc: m.referenceDoc,
    actorUser: m.actorUser ?? null,
    createdAt: m.createdAt.toISOString()
  };
}
