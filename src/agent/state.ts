import { Annotation } from "@langchain/langgraph";

import type { HotItem, RawHotItem } from "./types";

export const AgentState = Annotation.Root({
  rawItems: Annotation<RawHotItem[]>({
    reducer: (a, b) => b ?? a,
    default: () => [],
  }),
  merged: Annotation<HotItem[]>({
    reducer: (a, b) => b ?? a,
    default: () => [],
  }),
  top10: Annotation<HotItem[]>({
    reducer: (a, b) => b ?? a,
    default: () => [],
  }),
  summary: Annotation<string>({
    reducer: (_l, r) => r,
    default: () => "",
  }),
  errors: Annotation<string[]>({
    reducer: (a, b) => [...a, ...(b ?? [])],
    default: () => [],
  }),
});
