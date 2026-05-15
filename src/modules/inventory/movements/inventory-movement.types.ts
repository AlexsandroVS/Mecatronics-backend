import type { InventoryMovementType } from "@prisma/client";

export type InventoryMovementDTO = Readonly<{
  id: number;
  productId: number;
  type: InventoryMovementType;
  quantity: number;
  stockBefore: number;
  stockAfter: number;
  referenceDoc: string | null;
  actorUser: { id: number; email: string } | null;
  createdAt: string;
}>;

export type InventoryMovementGlobalDTO = InventoryMovementDTO &
  Readonly<{
    product: { id: number; skuInternal: string; name: string };
  }>;
