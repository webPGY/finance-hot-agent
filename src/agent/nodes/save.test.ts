import test, { mock } from "node:test";
import assert from "node:assert/strict";

import { getTodayDateKey } from "../../lib/date";
import prisma from "../../lib/prisma";
import { saveHotNewsBatch } from "../../lib/hotNewsRepository";
import { saveNode } from "./save";

test("getTodayDateKey uses Asia/Shanghai time zone", () => {
  const expected = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(new Date())
    .filter((part) => part.type !== "literal")
    .map((part) => (part.type === "year" ? part.value : part.type === "month" ? part.value : part.value))
    .join("")
    .replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");

  assert.equal(getTodayDateKey("Asia/Shanghai"), expected);
});

test("saveNode writes top10 and summary when data exists", async () => {
  let saveHotNewsCallCount = 0;
  let saveSummaryCallCount = 0;

  const result = await saveNode(
    {
      top10: [
        {
          source: "eastmoney",
          title: "热点A",
          url: "https://example.com/a",
          hotScore: 98,
          rank: 1,
          publishedAt: new Date("2026-09-11T09:00:00Z"),
        },
      ],
      summary: "今日热点概览",
      errors: ["test warning"],
    },
    {
      saveHotNewsBatch: async (items) => {
        saveHotNewsCallCount += items.length;
        return items.map((item) => ({ id: `news-${item.url}` } as any));
      },
      saveDailySummary: async () => {
        saveSummaryCallCount += 1;
        return undefined;
      },
    },
  );

  assert.equal(saveHotNewsCallCount, 1);
  assert.equal(saveSummaryCallCount, 1);
  assert.deepEqual(result.errors, ["test warning"]);
});

test("saveHotNewsBatch deduplicates same source and url in one batch", async () => {
  const duplicated = [
    {
      source: "cnbc",
      title: "热点A",
      url: "https://example.com/shared",
      hotScore: 100,
      rank: 1,
      publishedAt: new Date("2026-09-12T08:00:00Z"),
    },
    {
      source: "cnbc",
      title: "热点A",
      url: "https://example.com/shared",
      hotScore: 120,
      rank: 1,
      publishedAt: new Date("2026-09-12T08:00:00Z"),
    },
  ];

  const hotNews = prisma.hotNews as any;
  const originalDeleteMany = hotNews.deleteMany.bind(hotNews);
  const originalUpsert = hotNews.upsert.bind(hotNews);

  let upsertCallCount = 0;
  hotNews.deleteMany = async () => ({ count: 0 });
  hotNews.upsert = async ({ where }: { where: { source_url_date?: { source: string; url: string; date: string }; source_url?: { source: string; url: string } } }) => {
    upsertCallCount += 1;
    const unique = where.source_url_date ?? where.source_url;
    if (!unique) {
      throw new Error("missing unique key");
    }
    return {
      id: `hot:${unique.source}:${unique.url}:${"date" in unique ? unique.date : ""}`,
      source: unique.source,
      url: unique.url,
    };
  };

  try {
    const result = await saveHotNewsBatch(duplicated as any);

    assert.equal(result.length, 1);
    assert.equal(result[0].hotScore, 120);
    assert.equal(upsertCallCount, 1);
  } finally {
    hotNews.deleteMany = originalDeleteMany;
    hotNews.upsert = originalUpsert;
  }
});

test("saveHotNewsBatch keys same source and url by date so history rows are not overwritten", async () => {
  const hotNews = prisma.hotNews as any;
  const originalDeleteMany = hotNews.deleteMany.bind(hotNews);
  const originalUpsert = hotNews.upsert.bind(hotNews);

  const seenWhere: unknown[] = [];
  hotNews.deleteMany = async () => ({ count: 0 });
  hotNews.upsert = async ({ where, create }: { where: any; create: any }) => {
    seenWhere.push(where);
    return {
      id: `hot:${create.source}:${create.url}:${create.date}`,
      ...create,
    };
  };

  try {
    await saveHotNewsBatch([
      {
        source: "cnbc",
        title: "历史标题",
        url: "https://example.com/history",
        hotScore: 90,
        rank: 1,
        publishedAt: new Date("2026-09-11T08:00:00Z"),
      },
    ] as any);

    assert.equal((seenWhere[0] as any).source_url_date.source, "cnbc");
    assert.equal((seenWhere[0] as any).source_url_date.url, "https://example.com/history");
    assert.equal((seenWhere[0] as any).source_url_date.date, getTodayDateKey());
  } finally {
    hotNews.deleteMany = originalDeleteMany;
    hotNews.upsert = originalUpsert;
  }
});
