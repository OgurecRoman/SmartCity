-- AlterTable
ALTER TABLE "User" ADD COLUMN "chairmanHouseId" INTEGER;

UPDATE "User" SET "chairmanHouseId" = "houseId" WHERE "role" = 'CHAIRMAN' AND "houseId" IS NOT NULL;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_chairmanHouseId_fkey" FOREIGN KEY ("chairmanHouseId") REFERENCES "House"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "User_chairmanHouseId_idx" ON "User"("chairmanHouseId");
