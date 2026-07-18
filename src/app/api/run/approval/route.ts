import { NextResponse } from "next/server";

import { resolveApproval } from "@lib/agent";
import { getRun, saveRun } from "@lib/agent/store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    runId?: unknown;
    approved?: unknown;
  };
  const run = typeof body.runId === "string" ? getRun(body.runId) : undefined;
  if (!run) return NextResponse.json({ error: "Run not found." }, { status: 404 });
  if (typeof body.approved !== "boolean") {
    return NextResponse.json({ error: "approved must be a boolean." }, { status: 400 });
  }
  const delta = await resolveApproval(run, body.approved);
  saveRun(run);
  return NextResponse.json(delta);
}
