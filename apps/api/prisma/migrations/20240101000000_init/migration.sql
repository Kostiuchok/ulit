-- CreateEnum
CREATE TYPE "Role" AS ENUM ('AUTHOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "BookStatus" AS ENUM ('DRAFT', 'PROCESSING', 'REVIEW', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ModerationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DistributionStrategy" AS ENUM ('WIDE', 'KDP_SELECT');

-- CreateEnum
CREATE TYPE "ExternalStatus" AS ENUM ('NOT_SENT', 'SENT', 'PUBLISHED', 'ERROR');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PAID', 'FULFILLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RoyaltyStatus" AS ENUM ('PENDING', 'PAID');

-- CreateEnum
CREATE TYPE "ConversionStatus" AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "bio" TEXT,
    "avatarUrl" TEXT,
    "role" "Role" NOT NULL DEFAULT 'AUTHOR',
    "contractAcceptedAt" TIMESTAMP(3),
    "contractAcceptedIp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Book" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "authorId" TEXT NOT NULL,
    "status" "BookStatus" NOT NULL DEFAULT 'DRAFT',
    "moderationStatus" "ModerationStatus" NOT NULL DEFAULT 'PENDING',
    "moderationNote" TEXT,
    "isbn" TEXT,
    "coverUrl" TEXT,
    "originalDocxUrl" TEXT,
    "pdfUrl" TEXT,
    "epubUrl" TEXT,
    "fb2Url" TEXT,
    "mobiUrl" TEXT,
    "printPdfUrl" TEXT,
    "priceEbook" DECIMAL(10,2),
    "pricePrint" DECIMAL(10,2),
    "genre" TEXT,
    "language" TEXT NOT NULL DEFAULT 'uk',
    "pageCount" INTEGER,
    "previewStart" INTEGER,
    "previewEnd" INTEGER,
    "distributionStrategy" "DistributionStrategy" NOT NULL DEFAULT 'WIDE',
    "kdpSelectEnrolled" BOOLEAN NOT NULL DEFAULT false,
    "kdpSelectExpiry" TIMESTAMP(3),
    "d2dStatus" "ExternalStatus" NOT NULL DEFAULT 'NOT_SENT',
    "d2dSentAt" TIMESTAMP(3),
    "kdpStatus" "ExternalStatus" NOT NULL DEFAULT 'NOT_SENT',
    "kdpSentAt" TIMESTAMP(3),
    "googleStatus" "ExternalStatus" NOT NULL DEFAULT 'NOT_SENT',
    "googleSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "Book_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "paymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Royalty" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "source" TEXT NOT NULL,
    "status" "RoyaltyStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Royalty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversionJob" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "status" "ConversionStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "bullJobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversionJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_slug_key" ON "User"("slug");

-- CreateIndex
CREATE INDEX "User_slug_idx" ON "User"("slug");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Book_slug_key" ON "Book"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Book_isbn_key" ON "Book"("isbn");

-- CreateIndex
CREATE INDEX "Book_authorId_idx" ON "Book"("authorId");

-- CreateIndex
CREATE INDEX "Book_slug_idx" ON "Book"("slug");

-- CreateIndex
CREATE INDEX "Book_status_idx" ON "Book"("status");

-- CreateIndex
CREATE INDEX "Order_userId_idx" ON "Order"("userId");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "Royalty_authorId_idx" ON "Royalty"("authorId");

-- CreateIndex
CREATE INDEX "ConversionJob_bookId_idx" ON "ConversionJob"("bookId");

-- CreateIndex
CREATE UNIQUE INDEX "ConversionJob_bookId_format_key" ON "ConversionJob"("bookId", "format");

-- AddForeignKey
ALTER TABLE "Book" ADD CONSTRAINT "Book_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Royalty" ADD CONSTRAINT "Royalty_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Royalty" ADD CONSTRAINT "Royalty_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversionJob" ADD CONSTRAINT "ConversionJob_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;
