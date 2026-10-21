import { runAgentGraph } from "../agent/graph";

export async function runHotNewsJob() {
  const result = await runAgentGraph();
  return result;
}
