import test from "node:test";
import assert from "node:assert/strict";

import { rankNode } from "./rank";

test("rankNode sorts merged items and assigns rank numbers", async () => {
  const result = await rankNode({
    merged: [
      {
        source: "eastmoney",
        title: "热点A",
        url: "https://example.com/a",
        hotScore: 80,
        publishedAt: new Date("2026-09-11T09:00:00Z"),
      },
      {
        source: "sina",
        title: "热点B",
        url: "https://example.com/b",
        hotScore: 120,
        publishedAt: new Date("2026-09-11T10:00:00Z"),
      },
      {
        source: "xueqiu",
        title: "热点C",
        url: "https://example.com/c",
        hotScore: 100,
        publishedAt: new Date("2026-09-11T08:00:00Z"),
      },
    ],
  } as any);

  assert.deepEqual(
    result.top10.map((item) => item.title),
    ["热点B", "热点C", "热点A"],
  );
  assert.deepEqual(
    result.top10.map((item) => item.rank),
    [1, 2, 3],
  );
});

test("rankNode respects HOT_NEWS_COUNT from environment", async () => {
  process.env.HOT_NEWS_COUNT = "2";

  try {
    const result = await rankNode({
      merged: [
        { source: "sina", title: "热点1", url: "https://example.com/1", hotScore: 90, publishedAt: new Date("2026-09-11T12:00:00Z") },
        { source: "eastmoney", title: "热点2", url: "https://example.com/2", hotScore: 80, publishedAt: new Date("2026-09-11T11:00:00Z") },
        { source: "xueqiu", title: "热点3", url: "https://example.com/3", hotScore: 70, publishedAt: new Date("2026-09-11T10:00:00Z") },
      ],
    } as any);

    assert.equal(result.top10.length, 2);
    assert.deepEqual(result.top10.map((item) => item.title), ["热点1", "热点2"]);
  } finally {
    delete process.env.HOT_NEWS_COUNT;
  }
});

test("rankNode keeps a deterministic order and unique ranks for tied scores", async () => {
  const result = await rankNode({
    merged: [
      { source: "cnbc", title: "Zeta", url: "https://example.com/z", hotScore: 100, publishedAt: new Date("2026-09-11T09:00:00Z") },
      { source: "yahoo", title: "Alpha", url: "https://example.com/a", hotScore: 100, publishedAt: new Date("2026-09-11T09:00:00Z") },
      { source: "sina", title: "Beta", url: "https://example.com/b", hotScore: 100, publishedAt: new Date("2026-09-11T09:00:00Z") },
    ],
  } as any);

  assert.deepEqual(result.top10.map((item) => item.rank), [1, 2, 3]);
  assert.deepEqual(result.top10.map((item) => item.title), ["Alpha", "Beta", "Zeta"]);
});
