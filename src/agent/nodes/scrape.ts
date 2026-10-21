import { fetchHottestNews } from "../../datasources/aggregator";

export interface ScrapeState {
  rawItems?: any[];
  errors?: string[];
}

export async function scrapeNode(state: ScrapeState = {}) {
  try {
    const rawItems = await fetchHottestNews();
    return {
      ...state,
      rawItems,
      errors: state.errors ?? [],
    };
  } catch (error) {
    return {
      ...state,
      rawItems: [],
      errors: [...(state.errors ?? []), String(error)],
    };
  }
}
