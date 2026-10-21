import { getConfiguredHotNewsSource } from "../lib/hotNewsConfig";
import {
  fetchCnbcHotNews,
  fetchEastmoneyHotNews,
  fetchSinaHotNews,
  fetchXueqiuHotNews,
  fetchYahooFinanceHotNews,
} from "./providers";

const DEFAULT_HOT_NEWS_SOURCE = "cnbc";

export interface RawHotItem {
  source: string;
  title: string;
  url: string;
  hotScore?: number;
  publishedAt?: Date;
}

export type HotNewsProvider = () => Promise<RawHotItem[]>;

export interface FetchOptions {
  providers?: HotNewsProvider[];
  allowFallback?: boolean;
}

const staticSeed: RawHotItem[] = [
  {
    source: "eastmoney",
    title: "A股继续上涨，市场情绪改善",
    url: "https://example.com/1",
    hotScore: 120,
    publishedAt: new Date("2026-09-11T08:00:00Z"),
  },
  {
    source: "sina",
    title: "半导体板块走强",
    url: "https://example.com/2",
    hotScore: 95,
    publishedAt: new Date("2026-09-11T09:00:00Z"),
  },
  {
    source: "xueqiu",
    title: "新能源产业链回暖",
    url: "https://example.com/3",
    hotScore: 110,
    publishedAt: new Date("2026-09-11T07:00:00Z"),
  },
];

const homepageNoisePatterns = [
  /^新浪首页$/i,
  /^自选基金$/i,
  /^基金交易$/i,
  /^点击下载$/i,
  /^设为书签$/i,
  /^天天基金网$/i,
  /^东方财富手机版$/i,
  /^东方财富增值版$/i,
  /^移动客户端$/i,
  /^投教基地$/i,
  /^首页$/i,
  /^Yahoo! Finance:/i,
  /^US Top News and Analysis$/i,
  /^News$/i,
  /\^GSPC/i,
];

function isHomepageNoise(item: RawHotItem): boolean {
  const title = (item.title ?? "").trim();
  const url = (item.url ?? "").trim().toLowerCase();

  if (!title && !url) return true;

  if (homepageNoisePatterns.some((pattern) => pattern.test(title))) {
    return true;
  }

  return [
    "javascript:",
    "favor.fund.eastmoney.com",
    "fund.eastmoney.com",
    "trade.1234567.com.cn",
    "i2.sinaimg.cn",
    "sina.com.cn/",
    "xueqiu.com/",
    "eastmoney.com",
  ].some((needle) => url.includes(needle));
}

function normalizeTitle(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .trim();
}

export function mergeHotItems(items: RawHotItem[]): RawHotItem[] {
  const filtered = items.filter((item) => !isHomepageNoise(item));
  const byKey = new Map<string, RawHotItem>();

  for (const item of filtered) {
    const title = (item.title ?? "").trim();
    const normalized = normalizeTitle(title);
    const candidateKey = normalized || `${(item.source ?? "unknown").toLowerCase()}:${title}`;

    const existing = Array.from(byKey.entries()).find(([key, current]) => {
      if (key === candidateKey) return true;
      const currentTitle = normalizeTitle(current.title ?? "");
      return currentTitle && currentTitle === normalized;
    });

    if (existing) {
      const [key, current] = existing;
      const next =
        Number(item.hotScore ?? 0) > Number(current.hotScore ?? 0)
          ? { ...item, source: item.source || current.source }
          : current;

      byKey.set(key, next);
      continue;
    }

    byKey.set(candidateKey, item);
  }

  return Array.from(byKey.values()).sort(
    (a, b) => Number(b.hotScore ?? 0) - Number(a.hotScore ?? 0),
  );
}

export function resolveHotNewsProviders(providers: HotNewsProvider[] = []): HotNewsProvider[] {
  if (providers.length > 0) {
    return providers;
  }

  const defaultProviders = [
    fetchCnbcHotNews,
    fetchYahooFinanceHotNews,
  ];

  const allProviders = [
    fetchCnbcHotNews,
    fetchYahooFinanceHotNews,
  ];

  const configuredSource = getConfiguredHotNewsSource()
    .split(",")
    .map((source) => source.trim().toLowerCase())
    .filter(Boolean);

  if (configuredSource.length === 0) {
    return defaultProviders;
  }

  if (configuredSource.includes("all")) {
    return allProviders;
  }

  const providerMap: Record<string, HotNewsProvider> = {
    cnbc: fetchCnbcHotNews,
    yahoo: fetchYahooFinanceHotNews,
    "yahoo-finance": fetchYahooFinanceHotNews,
    eastmoney: fetchEastmoneyHotNews,
    sina: fetchSinaHotNews,
    xueqiu: fetchXueqiuHotNews,
  };

  const resolved = configuredSource
    .map((source) => providerMap[source])
    .filter((provider): provider is HotNewsProvider => Boolean(provider));

  return resolved.length > 0 ? resolved : defaultProviders;
}

export async function fetchHottestNews(
  providers: HotNewsProvider[] = [],
  options: FetchOptions = {},
): Promise<RawHotItem[]> {
  const allProviders = resolveHotNewsProviders(providers);
  const { allowFallback = true } = options;

  const collected: RawHotItem[] = [];

  for (const provider of allProviders) {
    try {
      const items = await provider();
      collected.push(...items);
    } catch {
      if (!allowFallback) {
        continue;
      }
    }
  }

  if (collected.length > 0) {
    return mergeHotItems(collected);
  }

  return mergeHotItems(staticSeed);
}
