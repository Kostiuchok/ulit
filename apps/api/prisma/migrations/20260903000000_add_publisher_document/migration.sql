CREATE TABLE IF NOT EXISTS "PublisherDocument" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "url" TEXT,
    "uploadedAt" TIMESTAMP(3),

    CONSTRAINT "PublisherDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PublisherDocument_key_key" ON "PublisherDocument"("key");
