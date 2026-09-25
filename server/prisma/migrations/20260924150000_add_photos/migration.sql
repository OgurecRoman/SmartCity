-- CreateTable
CREATE TABLE "Photo" (
    "id" SERIAL NOT NULL,
    "filename" TEXT NOT NULL,
    "requestId" INTEGER,
    "newsId" INTEGER,
    "announcementId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Photo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Photo_requestId_idx" ON "Photo"("requestId");

-- CreateIndex
CREATE INDEX "Photo_newsId_idx" ON "Photo"("newsId");

-- CreateIndex
CREATE INDEX "Photo_announcementId_idx" ON "Photo"("announcementId");

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_newsId_fkey" FOREIGN KEY ("newsId") REFERENCES "News"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
