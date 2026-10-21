import { END, START, StateGraph } from "@langchain/langgraph";

import { getCheckpointer } from "./checkpointer";
import { AgentState } from "./state";
import { scrapeNode } from "./nodes/scrape";
import { dedupNode } from "./nodes/dedup";
import { rankNode } from "./nodes/rank";
import { summarizeNode } from "./nodes/summarize";
import { saveNode, type SaveState } from "./nodes/save";
import { fallbackNode } from "./nodes/fallback";

function routeAfterRank(state: any) {
  return state.merged?.length > 0 ? "summarize" : "fallback";
}

const saveNodeAction = async (state: SaveState = {}) => saveNode(state);

export function createThreadId(prefix = "finance-hot-agent") {
  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
}

export async function runAgentGraph() {
  if (!(globalThis as any).crypto) {
    const { webcrypto } = await import("node:crypto");
    (globalThis as any).crypto = webcrypto;
  }

  const checkpointer = await getCheckpointer();

  const graph = new StateGraph(AgentState)
    .addNode("scrape", scrapeNode)
    .addNode("dedup", dedupNode)
    .addNode("rank", rankNode)
    .addNode("summarize", summarizeNode)
    .addNode("save", saveNodeAction)
    .addNode("fallback", fallbackNode)
    .addEdge(START, "scrape")
    .addEdge("scrape", "dedup")
    .addEdge("dedup", "rank")
    .addConditionalEdges("rank", routeAfterRank)
    .addEdge("summarize", "save")
    .addEdge("save", END)
    .addEdge("fallback", END);

  const compiled = graph.compile({ checkpointer });
  const threadId = createThreadId();
  const result = await compiled.invoke(
    {},
    { configurable: { thread_id: threadId } },
  );
  return result;
}
