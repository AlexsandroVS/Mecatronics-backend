import { describe, expect, it } from "vitest";
import type { InventoryMovementType } from "@prisma/client";
import { movementDelta } from "./inventory-movement.domain.js";

describe("movementDelta", () => {
  it("handles PURCHASE", () => {
    expect(movementDelta("PURCHASE" satisfies InventoryMovementType, 5)).toBe(5);
  });

  it("handles SALE", () => {
    expect(movementDelta("SALE" satisfies InventoryMovementType, 5)).toBe(-5);
  });

  it("handles WORKSHOP", () => {
    expect(movementDelta("WORKSHOP" satisfies InventoryMovementType, 2)).toBe(-2);
  });

  it("handles ADJUSTMENT", () => {
    expect(movementDelta("ADJUSTMENT" satisfies InventoryMovementType, -3)).toBe(-3);
    expect(movementDelta("ADJUSTMENT" satisfies InventoryMovementType, 3)).toBe(3);
  });
});

