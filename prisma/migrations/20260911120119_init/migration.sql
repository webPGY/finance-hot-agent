-- CreateTable
CREATE TABLE "hot_news" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "hotScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rank" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date" TEXT NOT NULL,
    "dailySummaryId" TEXT,

    CONSTRAINT "hot_news_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailySummary" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailySummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CronJob" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'default',
    "schedule" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Shanghai',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CronJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FetchRun" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'running',
    "source" TEXT,
    "message" TEXT,

    CONSTRAINT "FetchRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentRun" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "input" JSONB,
    "output" JSONB,
    "error" TEXT,

    CONSTRAINT "AgentRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hot_news_date_rank_idx" ON "hot_news"("date", "rank");

-- CreateIndex
CREATE INDEX "hot_news_publishedAt_idx" ON "hot_news"("publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "hot_news_source_url_key" ON "hot_news"("source", "url");

-- CreateIndex
CREATE UNIQUE INDEX "DailySummary_date_key" ON "DailySummary"("date");

-- CreateIndex
CREATE INDEX "AgentRun_threadId_idx" ON "AgentRun"("threadId");

-- CreateIndex
CREATE INDEX "AgentRun_startedAt_idx" ON "AgentRun"("startedAt");

-- AddForeignKey
ALTER TABLE "hot_news" ADD CONSTRAINT "hot_news_dailySummaryId_fkey" FOREIGN KEY ("dailySummaryId") REFERENCES "DailySummary"("id") ON DELETE SET NULL ON UPDATE CASCADE;
