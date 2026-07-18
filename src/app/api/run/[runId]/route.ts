import { NextResponse } from "next/server";

import { getRun, SESSION_EXPIRED_MESSAGE } from "@lib/agent/store";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ runId: string }> },
) {
  const { runId } = await context.params;
  const run = getRun(runId);
  if (!run) return NextResponse.json({ error: SESSION_EXPIRED_MESSAGE }, { status: 404 });
  return NextResponse.json({ run });
}
