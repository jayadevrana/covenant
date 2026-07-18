import { NextResponse } from "next/server";

import {
  LIVE_RUN_COOKIE,
  checkLiveRunGate,
  configuredLiveRunLimit,
  createAgentRun,
  liveRunCount,
} from "@lib/agent";
import { saveRun } from "@lib/agent/store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { task?: unknown; mode?: unknown };
  const mode = body.mode === "live" ? "live" : "fixture";
  const currentLiveRuns = liveRunCount(request.headers.get("cookie"));
  const liveRunLimit = configuredLiveRunLimit();
  if (mode === "live") {
    const gate = checkLiveRunGate({
      hasApiKey: Boolean(process.env.OPENAI_API_KEY),
      killSwitch: process.env.DAILY_SPEND_KILL,
      count: currentLiveRuns,
      limit: liveRunLimit,
    });
    if (!gate.allowed) {
      return NextResponse.json({ error: gate.error }, { status: gate.status });
    }
  }
  const run = createAgentRun({
    task: typeof body.task === "string" && body.task.trim() ? body.task : undefined,
    mode,
  });
  saveRun(run);
  const response = NextResponse.json({
    run,
    liveRunsRemaining: mode === "live" ? liveRunLimit - currentLiveRuns - 1 : null,
  });
  if (mode === "live") {
    response.cookies.set(LIVE_RUN_COOKIE, String(currentLiveRuns + 1), {
      httpOnly: true,
      maxAge: 60 * 60 * 24,
      path: "/",
      sameSite: "lax",
      secure: new URL(request.url).protocol === "https:",
    });
  }
  return response;
}
