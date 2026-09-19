-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('RESIDENT', 'UK_EMPLOYEE');

-- CreateEnum
CREATE TYPE "ResidentType" AS ENUM ('OWNER', 'TENANT');

-- CreateEnum
CREATE TYPE "RequestCategory" AS ENUM ('NOISE', 'ELEVATOR', 'PLUMBING', 'ELECTRICITY', 'REPAIR', 'CLEANING', 'SECURITY', 'OTHER');

-- CreateEnum
CREATE TYPE "RequestPriority" AS ENUM ('NORMAL', 'EMERGENCY');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('VOTING', 'SUBMITTED', 'IN_PROGRESS', 'DELEGATED', 'RESOLVED', 'REJECTED', 'EXPIRED');

-- CreateTable
CREATE TABLE "ManagementCompany" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "address" TEXT,
    "workingHours" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManagementCompany_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "House" (
    "id" SERIAL NOT NULL,
    "address" TEXT NOT NULL,
    "votePercent" INTEGER NOT NULL DEFAULT 20,
    "chatId" BIGINT,
    "chatTitle" TEXT,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "House_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "maxUserId" BIGINT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'RESIDENT',
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "username" TEXT,
    "houseId" INTEGER,
    "apartment" TEXT,
    "residentType" "ResidentType",
    "companyId" INTEGER,
    "onboardedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Request" (
    "id" SERIAL NOT NULL,
    "houseId" INTEGER NOT NULL,
    "authorId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "RequestCategory" NOT NULL,
    "priority" "RequestPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "RequestStatus" NOT NULL DEFAULT 'VOTING',
    "votesCount" INTEGER NOT NULL DEFAULT 0,
    "votesRequired" INTEGER NOT NULL DEFAULT 1,
    "deadline" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "delegatedToId" INTEGER,
    "delegatedAt" TIMESTAMP(3),
    "chatMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vote" (
    "id" SERIAL NOT NULL,
    "requestId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatusHistory" (
    "id" SERIAL NOT NULL,
    "requestId" INTEGER NOT NULL,
    "oldStatus" "RequestStatus",
    "newStatus" "RequestStatus" NOT NULL,
    "comment" TEXT,
    "changedById" INTEGER,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResponsibleOrganization" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "categories" "RequestCategory"[],

    CONSTRAINT "ResponsibleOrganization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotSession" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotSession_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "House_chatId_key" ON "House"("chatId");

-- CreateIndex
CREATE UNIQUE INDEX "User_maxUserId_key" ON "User"("maxUserId");

-- CreateIndex
CREATE INDEX "Request_houseId_status_idx" ON "Request"("houseId", "status");

-- CreateIndex
CREATE INDEX "Request_authorId_idx" ON "Request"("authorId");

-- CreateIndex
CREATE UNIQUE INDEX "Vote_requestId_userId_key" ON "Vote"("requestId", "userId");

-- CreateIndex
CREATE INDEX "StatusHistory_requestId_idx" ON "StatusHistory"("requestId");

-- AddForeignKey
ALTER TABLE "House" ADD CONSTRAINT "House_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "ManagementCompany"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_houseId_fkey" FOREIGN KEY ("houseId") REFERENCES "House"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "ManagementCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_houseId_fkey" FOREIGN KEY ("houseId") REFERENCES "House"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_delegatedToId_fkey" FOREIGN KEY ("delegatedToId") REFERENCES "ResponsibleOrganization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatusHistory" ADD CONSTRAINT "StatusHistory_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatusHistory" ADD CONSTRAINT "StatusHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResponsibleOrganization" ADD CONSTRAINT "ResponsibleOrganization_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "ManagementCompany"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
