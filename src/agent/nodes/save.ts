import { getTodayDateKey } from "../../lib/date";
import {
  saveDailySummary,
  saveHotNewsBatch,
} from "../../lib/hotNewsRepository";
import type { HotItem } from "../types";

export interface SaveState {
  top10?: HotItem[];
  summary?: string;
  errors?: string[];
}

export interface SaveDependencies {
  saveHotNewsBatch: typeof saveHotNewsBatch;
  saveDailySummary: typeof saveDailySummary;
}

const defaultSaveDependencies: SaveDependencies = {
  saveHotNewsBatch,
  saveDailySummary,
};

export async function saveNode(
  state: SaveState = {},
  deps: SaveDependencies | undefined = defaultSaveDependencies,
) {
  const top10 = state.top10 ?? [];
  const summary = state.summary ?? "";
  const errors = state.errors ?? [];

  if (top10.length === 0) {
    return { ...state, errors };
  }

  const saveDeps = deps ?? defaultSaveDependencies;
  const savedItems = await saveDeps.saveHotNewsBatch(top10);
  const date = getTodayDateKey();
  const newsIds = savedItems.map((item) => item.id);

  if (summary) {
    await saveDeps.saveDailySummary(date, summary, newsIds);
  }

  return {
    ...state,
    errors,
  };
}
