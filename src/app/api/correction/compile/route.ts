import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { fixtureCorrection } from "@data/correction-fixture";
import { getRun } from "@lib/agent/store";
import {
  classifyFailure,
  compileCorrection,
  createCompilerResponsesClient,
  type CorrectionCompilation,
} from "@lib/ai";
import { buildImmunityReview, getImmunitySession } from "@lib/immunity";
import { appendReceipt } from "@lib/receipts";
import type { Correction, JsonValue } from "@lib/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    runId?: unknown;
    actionId?: unknown;
    whatShouldHaveHappened?: unknown;
  };
  const run = typeof body.runId === "string" ? getRun(body.runId) : undefined;
  if (!run) return NextResponse.json({ error: "Run not found." }, { status: 404 });
  const selected = run.timeline.find(
    (entry) => entry.action?.id === body.actionId && entry.type === "decision",
  );
  if (!selected?.action || !selected.decision) {
    return NextResponse.json({ error: "Decided action not found." }, { status: 404 });
  }
  if (typeof body.whatShouldHaveHappened !== "string" || !body.whatShouldHaveHappened.trim()) {
    return NextResponse.json({ error: "Correction text is required." }, { status: 400 });
  }

  const correction: Correction = {
    id: randomUUID(),
    run_id: run.id,
    action_id: selected.action.id,
    what_happened: `${selected.action.tool} received ${selected.decision.verdict}.`,
    what_should_have_happened: body.whatShouldHaveHappened,
    author: "human",
  };
  const session = getImmunitySession(run.id);
  let compilation: CorrectionCompilation;
  let compilerProvenance = "FIXTURE";
  let classificationProvenance: string | null = null;

  if (run.mode === "fixture") {
    compilation = fixtureCorrection(correction);
  } else {
    const client = createCompilerResponsesClient();
    const classification = await classifyFailure({
      client,
      correction,
      selectedAction: selected.action,
    });
    if (!classification.ok) {
      return NextResponse.json({ error: classification.error }, { status: 502 });
    }
    classificationProvenance = `LIVE · ${classification.model}`;
    const compiled = await compileCorrection({
      client,
      correction,
      policy: session.policy,
      selectedAction: selected.action,
      failureClass: classification.data.failure_class,
    });
    if (!compiled.ok) return NextResponse.json({ error: compiled.error }, { status: 502 });
    compilation = compiled.data;
    compilerProvenance = `LIVE · ${compiled.model}`;
  }

  try {
    appendReceipt(run.receipts, {
      run_id: run.id,
      type: "correction",
      payload: {
        correction: correction as unknown as JsonValue,
        compiler_provenance: compilerProvenance,
      },
      timestamp: new Date().toISOString(),
    });
    return NextResponse.json({
      review: buildImmunityReview(session, correction, compilation),
      compilerProvenance,
      classificationProvenance,
      receipts: run.receipts,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Patch preview failed: ${message}` }, { status: 422 });
  }
}
