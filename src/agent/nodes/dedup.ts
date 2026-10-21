import type { HotItem, RawHotItem } from "../types";

export interface DedupState {
  rawItems?: RawHotItem[];
  merged?: HotItem[];
  errors?: string[];
}

function normalizeText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .replace(/\s+/g, "");
}

function toHotItem(item: RawHotItem): HotItem {
  return {
    source: item.source,
    title: item.title.trim(),
    url: item.url.trim(),
    hotScore: Number(item.hotScore ?? 0),
    rank: 0,
    publishedAt: item.publishedAt ?? new Date(),
  };
}

export async function dedupNode(state: DedupState = {}) {
  const rawItems = state.rawItems ?? [];
  const mergedMap = new Map<string, HotItem>();

  for (const item of rawItems) {
    if (!item?.title || !item?.url) continue;

    const normalizedUrl = normalizeText(item.url);
    const normalizedTitle = normalizeText(item.title);
    const key = normalizedUrl ? `${item.source}:${normalizedUrl}` : `${item.source}:${normalizedTitle}`;
    const candidate = toHotItem(item);
    const existing = mergedMap.get(key);

    if (!existing) {
      mergedMap.set(key, candidate);
      continue;
    }

    const shouldReplace = candidate.hotScore > existing.hotScore;
    if (shouldReplace || candidate.publishedAt > existing.publishedAt) {
      mergedMap.set(key, {
        ...existing,
        ...candidate,
        title: existing.title || candidate.title,
      });
    }
  }

  const merged = Array.from(mergedMap.values()).sort(
    (a, b) => b.hotScore - a.hotScore || b.publishedAt.getTime() - a.publishedAt.getTime(),
  );

  return {
    ...state,
    merged,
    errors: state.errors ?? [],
  };
}
