-- CreateTable
CREATE TABLE IF NOT EXISTS "ProductFeedback" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "rating" INTEGER,
    "comment" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProductFeedback_type_idx" ON "ProductFeedback"("type");
CREATE INDEX IF NOT EXISTS "ProductFeedback_userId_idx" ON "ProductFeedback"("userId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ProductFeedback_userId_fkey'
    ) THEN
        ALTER TABLE "ProductFeedback" ADD CONSTRAINT "ProductFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
