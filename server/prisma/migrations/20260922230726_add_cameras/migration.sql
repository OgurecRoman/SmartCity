-- CreateTable
CREATE TABLE "Camera" (
    "id" SERIAL NOT NULL,
    "houseId" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "streamUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Camera_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Camera_houseId_idx" ON "Camera"("houseId");

-- AddForeignKey
ALTER TABLE "Camera" ADD CONSTRAINT "Camera_houseId_fkey" FOREIGN KEY ("houseId") REFERENCES "House"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
