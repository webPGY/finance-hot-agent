import test from "node:test";
import assert from "node:assert/strict";

import { dedupNode } from "./dedup";

test("dedupNode merges same URL and keeps strongest record", async () => {
  const result = await dedupNode({
    rawItems: [
      {
        source: "eastmoney",
        title: "A股继续上涨，市场情绪改善",
        url: "https://example.com/1",
        hotScore: 120,
        publishedAt: new Date("2026-09-11T08:00:00Z"),
      },
      {
        source: "eastmoney",
        title: "A股继续上涨 市场情绪改善",
        url: "https://example.com/1",
        hotScore: 160,
        publishedAt: new Date("2026-09-11T09:00:00Z"),
      },
      {
        source: "sina",
        title: "半导体板块走强",
        url: "https://example.com/2",
        hotScore: 96,
        publishedAt: new Date("2026-09-11T10:00:00Z"),
      },
    ],
  } as any);

  assert.equal(result.merged.length, 2);
  assert.equal(result.merged[0].title, "A股继续上涨，市场情绪改善");
  assert.equal(result.merged[0].hotScore, 160);
  assert.equal(result.merged[1].title, "半导体板块走强");
});
