-- CreateTable
CREATE TABLE "ProductCompatibility" (
    "id" SERIAL NOT NULL,
    "partId" INTEGER NOT NULL,
    "machineId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductCompatibility_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductCompatibility_partId_idx" ON "ProductCompatibility"("partId");

-- CreateIndex
CREATE INDEX "ProductCompatibility_machineId_idx" ON "ProductCompatibility"("machineId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCompatibility_partId_machineId_key" ON "ProductCompatibility"("partId", "machineId");

-- AddForeignKey
ALTER TABLE "ProductCompatibility" ADD CONSTRAINT "ProductCompatibility_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCompatibility" ADD CONSTRAINT "ProductCompatibility_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
