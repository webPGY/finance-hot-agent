/*
  Warnings:

  - A unique constraint covering the columns `[source,url,date]` on the table `hot_news` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "hot_news_source_url_key";

-- CreateIndex
CREATE UNIQUE INDEX "hot_news_source_url_date_key" ON "hot_news"("source", "url", "date");
