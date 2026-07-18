import { describe, expect, it, vi } from "vitest";

import { seedDerivationContext, seedPolicy } from "../data/seed";
import { withCovenant } from "../sdk";

const now = () => "2026-07-18T13:00:00.000Z";

describe("withCovenant SDK wrapper", () => {
  it("returns a structured refusal and never executes a blocked tool", async () => {
    const execute = vi.fn(async () => ({ delivered: true }));
    const covenant = withCovenant(
      { send_email: { name: "send_email", execute } },
      seedPolicy,
      { runId: "sdk-block", now, derivationContext: seedDerivationContext },
    );

    const result = await covenant.tools.send_email.execute({
      recipients: ["reviewer@external.example"],
      attachments: [{ name: "july_12_incident_report", data_classes: ["customer_data"] }],
      data_classes: ["customer_data"],
    });

    expect(result).toMatchObject({ ok: false, skipped: true, reason: "blocked_by_policy" });
    expect(execute).not.toHaveBeenCalled();
    expect(covenant.receipts.map((event) => event.type)).toEqual([
      "task_started",
      "action_proposed",
      "decision",
      "tool_skipped",
    ]);
    expect(covenant.verifyReceipts().valid).toBe(true);
  });

  it("executes an approval-gated tool only after the hook approves it", async () => {
    const execute = vi.fn(async () => ({ delivered: true }));
    const onApprovalNeeded = vi.fn(async () => true);
    const covenant = withCovenant(
      { send_email: { name: "send_email", execute } },
      seedPolicy,
      { runId: "sdk-approval", now, derivationContext: seedDerivationContext, onApprovalNeeded },
    );

    const result = await covenant.tools.send_email.execute({
      recipients: Array.from({ length: 6 }, (_, index) => `contact@customer-${index + 1}.example`),
      data_classes: ["public"],
    });

    expect(result).toEqual({ delivered: true });
    expect(onApprovalNeeded).toHaveBeenCalledOnce();
    expect(execute).toHaveBeenCalledOnce();
    expect(covenant.receipts.some((event) => event.type === "approval")).toBe(true);
    expect(covenant.receipts.some((event) => event.type === "tool_executed")).toBe(true);
  });
});
