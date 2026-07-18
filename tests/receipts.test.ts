import { describe, expect, it } from "vitest";

import { createAgentRun, resolveApproval, stepAgent } from "../lib/agent";
import {
  GENESIS_HASH,
  appendReceipt,
  createReceiptExport,
  verifyReceiptChain,
} from "../lib/receipts";
import type { ReceiptEvent } from "../lib/schemas";

const now = () => "2026-07-18T04:10:00.000Z";

describe("hash-linked receipts", () => {
  it("verifies a genuine golden-run export", async () => {
    const run = createAgentRun({ id: "receipt-run", timestamp: now() });
    while (run.status === "running" && run.fixtureActionIndex < 4) await stepAgent(run, { now });
    await resolveApproval(run, true, { now });
    while (run.status === "running") await stepAgent(run, { now });

    const verification = verifyReceiptChain(run.receipts);
    const exported = createReceiptExport(run.receipts);

    expect(verification).toEqual({
      valid: true,
      head: run.receipts.at(-1)?.payload_hash,
      checked: run.receipts.length,
    });
    expect(exported.chain_head).toBe(verification.head);
    expect(exported.events).not.toBe(run.receipts);
    expect(exported.format).toBe("covenant-receipts-v1");
  });

  it("fails verification when one payload byte is flipped", () => {
    const events: ReceiptEvent[] = [];
    appendReceipt(events, {
      run_id: "tamper-run",
      type: "task_started",
      payload: { message: "safe" },
      timestamp: now(),
    });
    appendReceipt(events, {
      run_id: "tamper-run",
      type: "model_call",
      payload: { message: "second" },
      timestamp: now(),
    });
    const tampered = structuredClone(events);
    tampered[0].payload.message = "sage";

    expect(verifyReceiptChain(events).valid).toBe(true);
    expect(verifyReceiptChain(tampered)).toMatchObject({
      valid: false,
      error: "Payload hash mismatch at 0",
    });
  });

  it("uses the all-zero genesis hash and links each subsequent event", () => {
    const events: ReceiptEvent[] = [];
    appendReceipt(events, {
      run_id: "linked-run",
      type: "task_started",
      payload: {},
      timestamp: now(),
    });
    appendReceipt(events, {
      run_id: "linked-run",
      type: "model_call",
      payload: {},
      timestamp: now(),
    });

    expect(events[0].prev_hash).toBe(GENESIS_HASH);
    expect(events[1].prev_hash).toBe(events[0].payload_hash);
  });
});
