import type { RawHotItem } from "./aggregator";

const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const DEFAULT_FETCH_TIMEOUT_MS = 8000;
const YAHOO_FINANCE_RSS_URL = "https://feeds.finance.yahoo.com/rss/2.0/headline?s=%5EGSPC&region=US&lang=en-US";
const CNBC_RSS_URL = "https://www.cnbc.com/id/100003114/device/rss/rss.html";

function stripHtml(value: string) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function refineTitle(value: string) {
  const title = stripHtml(value).replace(/^\d+[\s.|-]+/, "").trim();
  return title.length > 3 ? title : "";
}

function toAbsoluteUrl(baseUrl: string, rawUrl: string) {
  try {
    return new URL(rawUrl, baseUrl).toString();
  } catch {
    return rawUrl;
  }
}

async function fetchPublicHtml(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status} ${response.statusText}`);
    }

    return response.text();
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchCnbcHotNews(): Promise<RawHotItem[]> {
  const xml = await fetchPublicHtml(CNBC_RSS_URL);
  const itemMatches = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)];

  const items: RawHotItem[] = [];
  for (const match of itemMatches.slice(0, 12)) {
    const itemXml = match[1] ?? "";
    const titleMatch = itemXml.match(/<title>([\s\S]*?)<\/title>/i);
    const linkMatch = itemXml.match(/<link>([\s\S]*?)<\/link>/i);
    const title = refineTitle(titleMatch?.[1] ?? "");
    const link = linkMatch?.[1]?.trim();

    if (!title || !link || /^US Top News and Analysis$/i.test(title)) continue;

    items.push({
      source: "cnbc",
      title,
      url: link,
      hotScore: 110 + items.length * 8,
      publishedAt: new Date(),
    });
  }

  return items.slice(0, 10);
}

export async function fetchYahooFinanceHotNews(): Promise<RawHotItem[]> {
  const xml = await fetchPublicHtml(YAHOO_FINANCE_RSS_URL);
  const itemMatches = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)];

  const items: RawHotItem[] = [];
  for (const match of itemMatches.slice(0, 12)) {
    const itemXml = match[1] ?? "";
    const titleMatch = itemXml.match(/<title>([\s\S]*?)<\/title>/i);
    const linkMatch = itemXml.match(/<link>([\s\S]*?)<\/link>/i);
    const rawTitle = titleMatch?.[1] ?? "";
    const title = refineTitle(rawTitle);
    const link = linkMatch?.[1]?.trim();

    if (!title || !link) continue;
    if (/^Yahoo! Finance:/i.test(title) || /\^GSPC|News$/i.test(title)) continue;

    items.push({
      source: "yahoo",
      title,
      url: link,
      hotScore: 100 + items.length * 7,
      publishedAt: new Date(),
    });
  }

  return items.slice(0, 10);
}

export async function fetchEastmoneyHotNews(): Promise<RawHotItem[]> {
  const html = await fetchPublicHtml("https://www.eastmoney.com/");
  const matches = [...html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi)];

  const items: RawHotItem[] = [];
  for (const match of matches.slice(0, 12)) {
    const href = match[1];
    const title = refineTitle(match[2] ?? "");
    if (!href || !title) continue;
    const url = toAbsoluteUrl("https://www.eastmoney.com/", href);
    if (/^(新浪首页|自选基金|基金交易|点击下载|设为书签|天天基金网|东方财富手机版|东方财富增值版|移动客户端|投教基地|首页)$/i.test(title)) continue;
    if (/javascript:|favor\.fund\.eastmoney\.com|fund\.eastmoney\.com|trade\.1234567\.com\.cn|i2\.sinaimg\.cn/i.test(url)) continue;
    items.push({
      source: "eastmoney",
      title,
      url,
      hotScore: 90 + items.length * 5,
      publishedAt: new Date(),
    });
  }

  return items.slice(0, 10);
}

export async function fetchSinaHotNews(): Promise<RawHotItem[]> {
  const html = await fetchPublicHtml("https://finance.sina.com.cn/");
  const matches = [...html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi)];

  const items: RawHotItem[] = [];
  for (const match of matches.slice(0, 15)) {
    const href = match[1];
    const title = refineTitle(match[2] ?? "");
    if (!href || !title) continue;
    const url = toAbsoluteUrl("https://finance.sina.com.cn/", href);
    if (/^(新浪首页|点击下载|设为书签|投教基地|首页)$/i.test(title)) continue;
    if (/javascript:|i2\.sinaimg\.cn|sina\.com\.cn\//i.test(url)) continue;
    items.push({
      source: "sina",
      title,
      url,
      hotScore: 80 + items.length * 5,
      publishedAt: new Date(),
    });
  }

  return items.slice(0, 10);
}

export async function fetchXueqiuHotNews(): Promise<RawHotItem[]> {
  const html = await fetchPublicHtml("https://xueqiu.com/");
  const matches = [...html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi)];

  const items: RawHotItem[] = [];
  for (const match of matches.slice(0, 15)) {
    const href = match[1];
    const title = refineTitle(match[2] ?? "");
    if (!href || !title) continue;
    const url = toAbsoluteUrl("https://xueqiu.com/", href);
    if (/^(首页|登录|注册|下载)$/i.test(title)) continue;
    if (/javascript:|xueqiu\.com\//i.test(url)) continue;
    items.push({
      source: "xueqiu",
      title,
      url,
      hotScore: 86 + items.length * 5,
      publishedAt: new Date(),
    });
  }

  return items.slice(0, 10);
}
