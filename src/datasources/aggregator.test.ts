import test from "node:test";
import assert from "node:assert/strict";

import { createThreadId } from "../agent/graph";
import { getConfiguredHotNewsSource, setHotNewsSourceConfig } from "../lib/hotNewsConfig";
import { fetchHottestNews, mergeHotItems, resolveHotNewsProviders } from "./aggregator";

test("fetchHottestNews returns a non-empty aggregated list", async () => {
  const items = await fetchHottestNews();
  assert.ok(items.length > 0);
  items.forEach((item) => {
    assert.ok(item.title);
    assert.ok(item.url);
    assert.ok(item.source);
  });
});

test("mergeHotItems keeps the strongest item for duplicate titles", () => {
  const items = mergeHotItems([
    { source: "eastmoney", title: "A股上涨", url: "https://example.com/1", hotScore: 10 },
    { source: "sina", title: "A股上涨", url: "https://example.com/2", hotScore: 20 },
    { source: "xueqiu", title: "新能源回暖", url: "https://example.com/3", hotScore: 15 },
  ]);

  assert.equal(items.length, 2);
  assert.equal(items[0].hotScore, 20);
  assert.equal(items[0].source, "sina");
});

test("fetchHottestNews falls back to a seed list when providers are unavailable", async () => {
  const items = await fetchHottestNews([], { allowFallback: true });
  assert.ok(items.length > 0);
  assert.ok(items.every((item) => item.title && item.url && item.source));
});

test("resolveHotNewsProviders respects HOT_NEWS_SOURCE env", () => {
  process.env.HOT_NEWS_SOURCE = "yahoo";

  try {
    const providers = resolveHotNewsProviders();
    assert.equal(providers.length, 1);
    assert.equal(providers[0].name, "fetchYahooFinanceHotNews");
  } finally {
    delete process.env.HOT_NEWS_SOURCE;
  }
});

test("createThreadId produces a fresh value for each run", () => {
  const threadA = createThreadId();
  const threadB = createThreadId();

  assert.notEqual(threadA, threadB);
  assert.match(threadA, /^finance-hot-agent:/);
  assert.match(threadB, /^finance-hot-agent:/);
});

test("all source expands to the verified provider set without homepage noise", () => {
  const previousSource = process.env.HOT_NEWS_SOURCE;
  const previousSources = process.env.HOT_NEWS_SOURCES;

  try {
    process.env.HOT_NEWS_SOURCE = "all";
    delete process.env.HOT_NEWS_SOURCES;

    const providers = resolveHotNewsProviders();
    const names = providers.map((provider) => provider.name);

    assert.ok(names.includes("fetchCnbcHotNews"));
    assert.ok(names.includes("fetchYahooFinanceHotNews"));
    assert.equal(names.includes("fetchEastmoneyHotNews"), false);
    assert.equal(names.includes("fetchSinaHotNews"), false);
    assert.equal(names.includes("fetchXueqiuHotNews"), false);
  } finally {
    if (previousSource === undefined) {
      delete process.env.HOT_NEWS_SOURCE;
    } else {
      process.env.HOT_NEWS_SOURCE = previousSource;
    }

    if (previousSources === undefined) {
      delete process.env.HOT_NEWS_SOURCES;
    } else {
      process.env.HOT_NEWS_SOURCES = previousSources;
    }
  }
});

test("default provider set avoids homepage-scrape noise sources", () => {
  const previousSource = process.env.HOT_NEWS_SOURCE;
  const previousSources = process.env.HOT_NEWS_SOURCES;

  try {
    delete process.env.HOT_NEWS_SOURCE;
    delete process.env.HOT_NEWS_SOURCES;

    const providers = resolveHotNewsProviders();
    const names = providers.map((provider) => provider.name);

    assert.equal(names.includes("fetchEastmoneyHotNews"), false);
    assert.equal(names.includes("fetchSinaHotNews"), false);
    assert.equal(names.includes("fetchXueqiuHotNews"), false);
    assert.equal(names.length >= 1, true);
  } finally {
    if (previousSource === undefined) {
      delete process.env.HOT_NEWS_SOURCE;
    } else {
      process.env.HOT_NEWS_SOURCE = previousSource;
    }

    if (previousSources === undefined) {
      delete process.env.HOT_NEWS_SOURCES;
    } else {
      process.env.HOT_NEWS_SOURCES = previousSources;
    }
  }
});

test("setHotNewsSourceConfig persists the selected source for runtime fetches", () => {
  const previous = process.env.HOT_NEWS_SOURCE;

  try {
    const source = setHotNewsSourceConfig("yahoo");
    assert.equal(source, "yahoo");
    assert.equal(getConfiguredHotNewsSource(), "yahoo");
  } finally {
    if (previous === undefined) {
      delete process.env.HOT_NEWS_SOURCE;
    } else {
      process.env.HOT_NEWS_SOURCE = previous;
    }
  }
});
