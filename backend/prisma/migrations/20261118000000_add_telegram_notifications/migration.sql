-- CreateTable
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT,
    "googleId" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "telegramChatId" TEXT,
    "telegramLinkToken" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Kyiv',

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Medication" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dosage" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "imageUrl" TEXT NOT NULL,
    "frequencyType" TEXT NOT NULL,
    "timesPerDay" INTEGER NOT NULL DEFAULT 1,
    "timesOfDay" TEXT NOT NULL,
    "daysOfWeek" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "endDate" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Medication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "DoseSchedule" (
    "id" TEXT NOT NULL,
    "medicationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scheduledDate" TEXT NOT NULL,
    "scheduledTime" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "actionAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "notifiedAt" TIMESTAMP(3),

    CONSTRAINT "DoseSchedule_pkey" PRIMARY KEY ("id")
);

-- AlterTable (for existing production databases)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "telegramChatId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "telegramLinkToken" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "timezone" TEXT NOT NULL DEFAULT 'Europe/Kyiv';

-- AlterTable (for existing production databases)
ALTER TABLE "DoseSchedule" ADD COLUMN IF NOT EXISTS "notifiedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "User_googleId_key" ON "User"("googleId");
CREATE UNIQUE INDEX IF NOT EXISTS "User_telegramChatId_key" ON "User"("telegramChatId");
CREATE UNIQUE INDEX IF NOT EXISTS "User_telegramLinkToken_key" ON "User"("telegramLinkToken");

CREATE INDEX IF NOT EXISTS "Medication_userId_idx" ON "Medication"("userId");
CREATE INDEX IF NOT EXISTS "DoseSchedule_userId_scheduledDate_idx" ON "DoseSchedule"("userId", "scheduledDate");
CREATE INDEX IF NOT EXISTS "DoseSchedule_medicationId_idx" ON "DoseSchedule"("medicationId");
CREATE INDEX IF NOT EXISTS "DoseSchedule_status_notifiedAt_idx" ON "DoseSchedule"("status", "notifiedAt");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Medication_userId_fkey'
    ) THEN
        ALTER TABLE "Medication" ADD CONSTRAINT "Medication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'DoseSchedule_medicationId_fkey'
    ) THEN
        ALTER TABLE "DoseSchedule" ADD CONSTRAINT "DoseSchedule_medicationId_fkey" FOREIGN KEY ("medicationId") REFERENCES "Medication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'DoseSchedule_userId_fkey'
    ) THEN
        ALTER TABLE "DoseSchedule" ADD CONSTRAINT "DoseSchedule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
