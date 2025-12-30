-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('queued', 'running', 'done', 'partial', 'failed');

-- CreateEnum
CREATE TYPE "JobPriority" AS ENUM ('normal', 'high');

-- CreateEnum
CREATE TYPE "JobItemStatus" AS ENUM ('pending', 'ok', 'error', 'blocked');

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'queued',
    "priority" "JobPriority" NOT NULL DEFAULT 'normal',
    "total" INTEGER NOT NULL,
    "processed" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobItem" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "status" "JobItemStatus" NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastStatusCode" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "username" TEXT,
    "displayName" TEXT,
    "bio" TEXT,
    "avatarUrl" TEXT,
    "coverUrl" TEXT,
    "publicStats" JSONB,
    "links" JSONB,
    "scrapedAt" TIMESTAMP(3) NOT NULL,
    "rawHtmlChecksum" TEXT NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Job_status_idx" ON "Job"("status");

-- CreateIndex
CREATE INDEX "Job_createdAt_idx" ON "Job"("createdAt");

-- CreateIndex
CREATE INDEX "JobItem_jobId_idx" ON "JobItem"("jobId");

-- CreateIndex
CREATE INDEX "JobItem_status_idx" ON "JobItem"("status");

-- CreateIndex
CREATE UNIQUE INDEX "JobItem_jobId_url_key" ON "JobItem"("jobId", "url");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_sourceUrl_key" ON "Profile"("sourceUrl");

-- CreateIndex
CREATE INDEX "Profile_username_idx" ON "Profile"("username");

-- CreateIndex
CREATE INDEX "Profile_displayName_idx" ON "Profile"("displayName");

-- AddForeignKey
ALTER TABLE "JobItem" ADD CONSTRAINT "JobItem_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
