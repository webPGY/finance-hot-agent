import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { runAgentGraph } from "../../../../src/agent/graph";

export async function GET() {
  try {
    const result = await runAgentGraph();
    revalidatePath("/");
    revalidatePath("/history");
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

export async function POST() {
  return GET();
}
