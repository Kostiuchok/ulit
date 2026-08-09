-- AlterTable
ALTER TABLE "Book" ADD COLUMN IF NOT EXISTS "republishRequestedAt" TIMESTAMP(3);
