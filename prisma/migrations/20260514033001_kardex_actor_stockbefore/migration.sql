-- AlterTable
ALTER TABLE "InventoryMovement" ADD COLUMN     "actorUserId" INTEGER,
ADD COLUMN     "stockBefore" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "InventoryMovement_actorUserId_createdAt_idx" ON "InventoryMovement"("actorUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
