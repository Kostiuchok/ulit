ALTER TABLE "Book" ADD COLUMN IF NOT EXISTS "printPageCount" INTEGER;

CREATE TABLE IF NOT EXISTS "PrintCostSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "baseCostSoftcover" DECIMAL(10,2) NOT NULL,
    "baseCostHardcover" DECIMAL(10,2) NOT NULL,
    "costPerPage" DECIMAL(10,4) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrintCostSettings_pkey" PRIMARY KEY ("id")
);
