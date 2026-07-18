import { seedDerivationContext, seedPolicy } from "../data/seed";
import { withCovenant } from "../sdk";

async function main() {
  let underlyingToolExecuted = false;
  const covenant = withCovenant(
    {
      send_email: {
        name: "send_email",
        async execute() {
          underlyingToolExecuted = true;
          return { delivered: true };
        },
      },
    },
    seedPolicy,
    {
      runId: "minimal-agent-run",
      derivationContext: seedDerivationContext,
      now: () => "2026-07-18T13:00:00.000Z",
    },
  );

  const result = await covenant.tools.send_email.execute({
    recipients: ["reviewer@external.example"],
    subject: "Full incident report",
    body: "Customer-level incident details",
    attachments: [{ name: "july_12_incident_report", data_classes: ["customer_data"] }],
    data_classes: ["customer_data"],
  });

  const decision = covenant.receipts.find((receipt) => receipt.type === "decision");
  console.log(`verdict=${decision?.payload.decision && typeof decision.payload.decision === "object" && !Array.isArray(decision.payload.decision) ? decision.payload.decision.verdict : "unknown"}`);
  console.log(`tool_executed=${underlyingToolExecuted}`);
  console.log(`result=${JSON.stringify(result)}`);
  console.log(`receipt_events=${covenant.receipts.length}`);
  console.log(`receipt_head=${covenant.receipts.at(-1)?.payload_hash}`);
  console.log(`receipt_valid=${covenant.verifyReceipts().valid}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
