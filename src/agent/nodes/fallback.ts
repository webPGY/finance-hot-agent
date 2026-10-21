export interface FallbackState {
  merged?: any[];
  top10?: any[];
  summary?: string;
  errors?: string[];
}

export async function fallbackNode(state: FallbackState = {}) {
  const errors = state.errors ?? [];
  const fallbackError = "No merged items available; fallback node triggered.";

  return {
    ...state,
    top10: state.top10 ?? [],
    summary: state.summary ?? "今日暂无有效热点数据，已触发兜底逻辑。",
    errors: [...errors, fallbackError],
  };
}
