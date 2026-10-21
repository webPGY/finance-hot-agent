import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";

let checkpointerInstance: PostgresSaver | null = null;

/**
 * 创建/复用 PostgresSaver。
 * setup() 会自动建 checkpoint 相关表，无需人工介入。
 */
export async function getCheckpointer(): Promise<PostgresSaver> {
  if (checkpointerInstance) return checkpointerInstance;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is required to initialize the LangGraph Postgres checkpointer.",
    );
  }

  const saver = PostgresSaver.fromConnString(databaseUrl, {
    schema: "public",
  });
  await saver.setup();
  checkpointerInstance = saver;
  return saver;
}
