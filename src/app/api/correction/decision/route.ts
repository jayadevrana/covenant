import { NextResponse } from "next/server";

import { getRun } from "@lib/agent/store";
import { decideImmunityReview, getImmunitySession } from "@lib/immunity";
import { appendReceipt } from "@lib/receipts";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    runId?: unknown;
    decision?: unknown;
  };
  const run = typeof body.runId === "string" ? getRun(body.runId) : undefined;
  if (!run) return NextResponse.json({ error: "Run not found." }, { status: 404 });
  if (body.decision !== "approve" && body.decision !== "reject") {
    return NextResponse.json({ error: "Decision must be approve or reject." }, { status: 400 });
  }
  try {
    const result = decideImmunityReview(getImmunitySession(run.id), body.decision);
    if (body.decision === "approve") run.policy = structuredClone(result.policy);
    appendReceipt(run.receipts, {
      run_id: run.id,
      type: "approval",
      payload: {
        subject: "policy_patch",
        decision: body.decision,
        patch_id: result.patch.id,
        resulting_policy_version: result.policy.version,
      },
      timestamp: new Date().toISOString(),
    });
    return NextResponse.json({ result, receipts: run.receipts });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
