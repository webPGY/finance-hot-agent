import type { HotItem } from "../types";

const DEFAULT_HOT_NEWS_COUNT = 10;

function getHotNewsCount() {
  const raw = Number(process.env.HOT_NEWS_COUNT ?? DEFAULT_HOT_NEWS_COUNT);
  if (!Number.isFinite(raw) || raw <= 0) {
    return DEFAULT_HOT_NEWS_COUNT;
  }
  return Math.floor(raw);
}

export interface RankState {
  merged?: HotItem[];
  top10?: HotItem[];
  errors?: string[];
}

export async function rankNode(state: RankState = {}) {
  const merged = [...(state.merged ?? [])].sort((a, b) => {
    const scoreDiff = b.hotScore - a.hotScore;
    if (scoreDiff !== 0) {
      return scoreDiff;
    }

    const publishedDiff = b.publishedAt.getTime() - a.publishedAt.getTime();
    if (publishedDiff !== 0) {
      return publishedDiff;
    }

    return (a.title ?? "").localeCompare(b.title ?? "");
  });

  const limit = getHotNewsCount();
  const top10 = merged.slice(0, limit).map((item, index) => ({
    ...item,
    rank: index + 1,
  }));

  return {
    ...state,
    merged,
    top10,
    errors: state.errors ?? [],
  };
}
