export interface SummarizeState {
  top10?: Array<{ title: string; source: string; hotScore: number }>;
  summary?: string;
  errors?: string[];
}

export async function summarizeNode(state: SummarizeState = {}) {
  const top10 = state.top10 ?? [];
  const summary =
    top10.length > 0
      ? `今日热点概览：${top10
          .slice(0, 5)
          .map((item) => `${item.title}（${item.source}）`)
          .join("；")}`
      : "今日暂无有效热点数据。";

  return {
    ...state,
    summary,
    errors: state.errors ?? [],
  };
}
