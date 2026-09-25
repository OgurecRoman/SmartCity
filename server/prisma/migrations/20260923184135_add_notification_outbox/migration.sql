-- CreateTable
CREATE TABLE "NotificationOutbox" (
    "id" SERIAL NOT NULL,
    "event" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationOutbox_pkey" PRIMARY KEY ("id")
);
