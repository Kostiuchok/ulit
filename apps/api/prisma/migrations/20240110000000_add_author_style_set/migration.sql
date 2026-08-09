-- CreateTable
CREATE TABLE IF NOT EXISTS "AuthorStyleSet" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "styleOverrides" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthorStyleSet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AuthorStyleSet_authorId_idx" ON "AuthorStyleSet"("authorId");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "AuthorStyleSet" ADD CONSTRAINT "AuthorStyleSet_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
