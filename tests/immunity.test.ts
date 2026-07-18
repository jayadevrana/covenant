import { describe, expect, it, vi } from "vitest";

import { fixtureCorrection } from "../data/correction-fixture";
import { seedEvals } from "../data/evals";
import { goldenTrace, seedPolicy } from "../data/seed";
import { createAgentRun, stepAgent, type AgentResponsesClient } from "../lib/agent";
import {
  classifyFailure,
  type ResponsesClient,
  type StructuredResponseRequest,
} from "../lib/ai";
import {
  buildImmunityReview,
  createImmunitySession,
  decideImmunityReview,
  runEvalSuite,
  summarizeEvalResults,
} from "../lib/immunity";
import type { Correction } from "../lib/schemas";

const correction: Correction = {
  id: "correction-immunity",
  run_id: "golden-run",
  action_id: goldenTrace[4].id,
  what_happened: "The customer-data report was blocked.",
  what_should_have_happened: "Send a redacted summary with customer data removed.",
  author: "human",
};

describe("deterministic immunity eval runner", () => {
  it("passes all twelve seed evals against the seed policy", () => {
    const results = runEvalSuite(seedEvals, seedPolicy);

    expect(seedEvals).toHaveLength(12);
    expect(summarizeEvalResults(results)).toEqual({ passed: 12, total: 12, failed: 0 });
  });

  it("proves the generated case red before and green after with zero regressions", () => {
    const session = createImmunitySession();
    const compilation = fixtureCorrection(correction);
    const review = buildImmunityReview(session, correction, compilation);
    const generatedBefore = review.before.results.find(
      (result) => result.eval_id === compilation.generated_eval.id,
    );
    const generatedAfter = review.after.results.find(
      (result) => result.eval_id === compilation.generated_eval.id,
    );

    expect(review.before.summary).toEqual({ passed: 12, total: 13, failed: 1 });
    expect(review.after.summary).toEqual({ passed: 13, total: 13, failed: 0 });
    expect(generatedBefore?.passed).toBe(false);
    expect(generatedAfter?.passed).toBe(true);
    expect(review.regressions).toBe(0);
  });

  it("activates an approved patch, bumps policy version, and retains all passes", () => {
    const session = createImmunitySession();
    buildImmunityReview(session, correction, fixtureCorrection(correction));
    const result = decideImmunityReview(session, "approve");

    expect(result.patch.status).toBe("approved");
    expect(result.policy.version).toBe(2);
    expect(result.summary).toEqual({ passed: 13, total: 13, failed: 0 });
    expect(session.evals).toHaveLength(13);
  });

  it("uses the human-approved policy version for subsequent runtime interception", async () => {
    const session = createImmunitySession();
    buildImmunityReview(session, correction, fixtureCorrection(correction));
    const approved = decideImmunityReview(session, "approve");
    const client: AgentResponsesClient = {
      responses: {
        create: vi.fn(async () => ({
          model: "gpt-5.6-sol",
          output: [
            {
              type: "function_call",
              name: "send_email",
              call_id: "redacted-call",
              arguments: JSON.stringify({
                recipients: ["ben@partnerco.example"],
                subject: "Redacted incident summary",
                body: "Aggregate details only",
                attachments: [
                  { name: "redacted_incident_summary", data_classes: ["public"] },
                ],
                data_classes: ["public"],
              }),
            },
          ],
        })),
      },
    };
    const run = createAgentRun({ id: "approved-runtime", mode: "live" });
    run.policy = approved.policy;
    await stepAgent(run, { client, now: () => "2026-07-18T04:20:00.000Z" });

    expect(run.status).toBe("awaiting_approval");
    expect(run.timeline.find((entry) => entry.type === "decision")?.decision).toMatchObject({
      verdict: "require_approval",
      policy_version: 2,
    });
  });

  it("leaves policy version, rules, and evals unchanged when a patch is rejected", () => {
    const session = createImmunitySession();
    const originalPolicy = structuredClone(session.policy);
    const originalEvals = structuredClone(session.evals);
    buildImmunityReview(session, correction, fixtureCorrection(correction));
    const result = decideImmunityReview(session, "reject");

    expect(result.patch.status).toBe("rejected");
    expect(result.policy).toEqual(originalPolicy);
    expect(session.policy).toEqual(originalPolicy);
    expect(session.evals).toEqual(originalEvals);
    expect(result.summary).toEqual({ passed: 12, total: 12, failed: 0 });
  });
});

describe("cheap failure classification", () => {
  it("uses gpt-5.6-terra with a strict 200-token structured request", async () => {
    const requests: StructuredResponseRequest[] = [];
    const create = vi.fn(async (request: StructuredResponseRequest) => {
      requests.push(structuredClone(request));
      return {
        model: "gpt-5.6-terra",
        output_text: JSON.stringify({ failure_class: "policy_gap" }),
        usage: { total_tokens: 20 },
      };
    });
    const client: ResponsesClient = { responses: { create } };
    const result = await classifyFailure({
      client,
      correction,
      selectedAction: goldenTrace[4],
    });

    expect(result.ok).toBe(true);
    expect(requests[0]).toMatchObject({
      model: "gpt-5.6-terra",
      max_output_tokens: 200,
      reasoning: { effort: "low" },
      text: { format: { type: "json_schema", strict: true } },
    });
  });
});
