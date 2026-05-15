import { describe, expect, it } from "vitest";
import { toInventoryMovementDTO } from "./inventory-movement.mapper.js";

describe("toInventoryMovementDTO", () => {
  it("maps fields and formats createdAt", () => {
    const createdAt = new Date("2026-05-14T12:34:56.000Z");
    const dto = toInventoryMovementDTO({
      id: 10,
      productId: 20,
      type: "PURCHASE",
      quantity: 5,
      stockBefore: 3,
      stockAfter: 8,
      referenceDoc: "OC-001",
      actorUser: { id: 1, email: "admin@example.com" },
      createdAt
    });

    expect(dto).toEqual({
      id: 10,
      productId: 20,
      type: "PURCHASE",
      quantity: 5,
      stockBefore: 3,
      stockAfter: 8,
      referenceDoc: "OC-001",
      actorUser: { id: 1, email: "admin@example.com" },
      createdAt: "2026-05-14T12:34:56.000Z"
    });
  });

  it("sets actorUser to null when missing", () => {
    const dto = toInventoryMovementDTO({
      id: 1,
      productId: 2,
      type: "SALE",
      quantity: 1,
      stockBefore: 10,
      stockAfter: 9,
      referenceDoc: null,
      createdAt: new Date("2026-05-14T00:00:00.000Z")
    });

    expect(dto.actorUser).toBeNull();
  });
});

