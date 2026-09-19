/*
  Warnings:

  - A unique constraint covering the columns `[externalId]` on the table `House` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "House" ADD COLUMN     "apartmentsCount" INTEGER,
ADD COLUMN     "dataSource" TEXT,
ADD COLUMN     "entrances" JSONB,
ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "lat" DOUBLE PRECISION,
ADD COLUMN     "lng" DOUBLE PRECISION;

-- CreateIndex
CREATE UNIQUE INDEX "House_externalId_key" ON "House"("externalId");
