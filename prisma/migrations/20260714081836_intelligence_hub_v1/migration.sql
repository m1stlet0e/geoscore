-- CreateTable
CREATE TABLE "OwnedSource" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OwnedSource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OwnedSource_brandId_domain_idx" ON "OwnedSource"("brandId", "domain");

-- CreateIndex
CREATE UNIQUE INDEX "OwnedSource_brandId_url_key" ON "OwnedSource"("brandId", "url");

-- AddForeignKey
ALTER TABLE "OwnedSource" ADD CONSTRAINT "OwnedSource_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
