import { Prisma } from "@prisma/client";
import { getTodayDateKey } from "./date";
import prisma from "./prisma";
import type { HotItem } from "../agent/types";

function normalizeSource(source: string) {
  return String(source ?? "").trim().toLowerCase() === "yahoo-finance" ? "yahoo" : String(source ?? "").trim().toLowerCase();
}

/**
 * 单条 upsert：同 source + url 视为同一条，有则更新热度/排名，无则插入。
 * 天然幂等 —— LangGraph 重试或重复抓取都不会产生脏数据。
 */
export async function upsertHotNews(item: HotItem) {
  const source = normalizeSource(item.source);
  const date = getTodayDateKey();
  return prisma.hotNews.upsert({
    where: {
      source_url_date: { source, url: item.url, date },
    },
    update: {
      hotScore: item.hotScore,
      rank: item.rank,
      fetchedAt: new Date(),
    },
    create: {
      title: item.title,
      url: item.url,
      source,
      hotScore: item.hotScore,
      rank: item.rank,
      publishedAt: item.publishedAt,
      date,
    },
  });
}

/**
 * 批量 upsert（推荐）：一次抓取结果整体写入。
 * 顺序执行以避免部分数据库对 bulk upsert 的限制；如需更高性能可改 batch。
 */
export async function saveHotNewsBatch(items: HotItem[]) {
  const normalizedItems = items
    .map((item) => ({
      ...item,
      source: normalizeSource(item.source),
      publishedAt: item.publishedAt ?? new Date(),
    }))
    .reduce<HotItem[]>((result, item) => {
      const key = `${item.source}:${item.url}`;
      const existingIndex = result.findIndex((candidate) => `${candidate.source}:${candidate.url}` === key);

      if (existingIndex === -1) {
        result.push(item);
        return result;
      }

      const current = result[existingIndex];
      const nextItem = (Number(item.hotScore ?? 0) > Number(current.hotScore ?? 0) ? item : current) as HotItem;
      result[existingIndex] = nextItem;
      return result;
    }, []);

  const groupedBySourceDate = new Map<string, HotItem[]>();
  for (const item of normalizedItems) {
    const date = getTodayDateKey();
    const key = `${item.source}:${date}`;
    const existing = groupedBySourceDate.get(key) ?? [];
    existing.push(item);
    groupedBySourceDate.set(key, existing);
  }

  for (const [key, batchItems] of groupedBySourceDate.entries()) {
    const [source, date] = key.split(":");
    if (!source || !date) continue;
    await prisma.hotNews.deleteMany({
      where: {
        source,
        date,
      },
    });

    for (const item of batchItems) {
      await prisma.hotNews.upsert({
        where: {
          source_url_date: {
            source: item.source,
            url: item.url,
            date,
          },
        },
        update: {
          title: item.title,
          hotScore: item.hotScore,
          rank: item.rank,
          publishedAt: item.publishedAt,
          date,
          fetchedAt: new Date(),
        },
        create: {
          title: item.title,
          url: item.url,
          source: item.source,
          hotScore: item.hotScore,
          rank: item.rank,
          publishedAt: item.publishedAt,
          date,
        },
      });
    }
  }

  return normalizedItems.map((item) => ({
    id: `${item.source}:${item.url}`,
    source: item.source,
    url: item.url,
    title: item.title,
    hotScore: item.hotScore,
    rank: item.rank,
    publishedAt: item.publishedAt,
  }));
}

/**
 * 读取某天的 TopN（页面展示用）
 */
export async function getTopNews(date: string, limit = 10) {
  return prisma.hotNews.findMany({
    where: { date },
    orderBy: [{ rank: "asc" }, { hotScore: "desc" }],
    take: limit,
  });
}

/**
 * 保存每日摘要并关联该批次新闻（事务保证一致性）
 */
export async function saveDailySummary(date: string, summary: string, newsIds: string[]) {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.dailySummary.upsert({
      where: { date },
      update: { summary },
      create: { date, summary },
    });

    if (newsIds.length > 0) {
      await tx.dailySummary.update({
        where: { date },
        data: { news: { set: newsIds.map((id) => ({ id })) } },
      });
    }
  });
}

export async function recordAgentRun({
  threadId,
  status,
  input,
  output,
  error,
}: {
  threadId: string;
  status: string;
  input?: unknown;
  output?: unknown;
  error?: string;
}) {
  return prisma.agentRun.create({
    data: {
      threadId,
      status,
      input: input ? (input as Prisma.InputJsonValue) : undefined,
      output: output ? (output as Prisma.InputJsonValue) : undefined,
      error,
    },
  });
}
