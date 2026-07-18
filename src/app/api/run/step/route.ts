import { NextResponse } from "next/server";

import { stepAgent } from "@lib/agent";
import { getRun, saveRun, SESSION_EXPIRED_MESSAGE } from "@lib/agent/store";
import { createAgentResponsesClient } from "@lib/ai";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { runId?: unknown };
  const run = typeof body.runId === "string" ? getRun(body.runId) : undefined;
  if (!run) return NextResponse.json({ error: SESSION_EXPIRED_MESSAGE }, { status: 404 });

  const delta = await stepAgent(run, {
    client: run.mode === "live" ? createAgentResponsesClient() : undefined,
  });
  saveRun(run);
  return NextResponse.json(delta);
}
