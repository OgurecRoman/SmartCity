-- CreateTable
CREATE TABLE "UserHouse" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "houseId" INTEGER NOT NULL,
    "apartment" TEXT,
    "residentType" "ResidentType" NOT NULL DEFAULT 'OWNER',
    "verifiedFullName" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserHouse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserHouse_houseId_idx" ON "UserHouse"("houseId");

-- CreateIndex
CREATE UNIQUE INDEX "UserHouse_userId_houseId_key" ON "UserHouse"("userId", "houseId");

-- AddForeignKey
ALTER TABLE "UserHouse" ADD CONSTRAINT "UserHouse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserHouse" ADD CONSTRAINT "UserHouse_houseId_fkey" FOREIGN KEY ("houseId") REFERENCES "House"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Перенос существующих данных: активный дом каждого подтверждённого жителя становится записью в UserHouse.
INSERT INTO "UserHouse" ("userId", "houseId", "apartment", "residentType", "verifiedFullName", "joinedAt")
SELECT "id", "houseId", "apartment", COALESCE("residentType", 'OWNER'), "verifiedFullName", COALESCE("onboardedAt", NOW())
FROM "User"
WHERE "houseId" IS NOT NULL AND "onboardedAt" IS NOT NULL
ON CONFLICT ("userId", "houseId") DO NOTHING;
