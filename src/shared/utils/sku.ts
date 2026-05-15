import { randomUUID } from "node:crypto";

export function generateSkuInternal(): string {
  const id = randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase();
  return `SKU-${id}`;
}

