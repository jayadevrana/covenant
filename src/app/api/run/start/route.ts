import { NextResponse } from "next/server";

import { createAgentRun } from "@lib/agent";
import { saveRun } from "@lib/agent/store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { task?: unknown; mode?: unknown };
  const mode = body.mode === "live" ? "live" : "fixture";
  if (mode === "live" && !process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "Live mode requires a server API key." }, { status: 503 });
  }
  const run = createAgentRun({
    task: typeof body.task === "string" && body.task.trim() ? body.task : undefined,
    mode,
  });
  saveRun(run);
  return NextResponse.json({ run });
}
