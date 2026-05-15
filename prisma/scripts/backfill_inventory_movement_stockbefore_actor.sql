WITH ordered AS (
  SELECT
    "id",
    LAG("stockAfter") OVER (PARTITION BY "productId" ORDER BY "createdAt" ASC, "id" ASC) AS prev
  FROM "InventoryMovement"
)
UPDATE "InventoryMovement" m
SET "stockBefore" = COALESCE(o.prev, 0)
FROM ordered o
WHERE m."id" = o."id";

UPDATE "InventoryMovement" m
SET "actorUserId" = a."actorUserId"
FROM "AuditLog" a
WHERE a."entityType" = 'InventoryMovement'
  AND a."action" = 'INVENTORY_MOVEMENT_CREATE'
  AND a."entityId" = m."id"
  AND a."actorUserId" IS NOT NULL
  AND m."actorUserId" IS NULL;
