import type { InventoryMovementType } from "@prisma/client";

export function movementDelta(type: InventoryMovementType, quantity: number): number {
  switch (type) {
    case "PURCHASE":
      return quantity;
    case "SALE":
      return -quantity;
    case "WORKSHOP":
      return -quantity;
    case "ADJUSTMENT":
      return quantity;
  }
}

