import { goldenTrace } from "../data/seed";
import {
  classifyFailure,
  compileCorrection,
  createCompilerResponsesClient,
} from "../lib/ai";
import {
  buildImmunityReview,
  createImmunitySession,
} from "../lib/immunity";
import type { Correction } from "../lib/schemas";
import { hasOpenAIKey } from "./openai-env";

async function main() {
  if (!hasOpenAIKey()) throw new Error("OPENAI_API_KEY is required for the live M5 gate");

  const correction: Correction = {
    id: "live-correction-gate",
    run_id: "live-golden-gate",
    action_id: goldenTrace[4].id,
    what_happened: "The full customer-data incident report was correctly blocked.",
    what_should_have_happened:
      "It should have sent the partner a redacted summary with customer data removed.",
    author: "human",
  };
  const client = createCompilerResponsesClient();
  const classification = await classifyFailure({
    client,
    correction,
    selectedAction: goldenTrace[4],
  });
  if (!classification.ok) throw new Error(`classification failed: ${classification.error.message}`);

  const session = createImmunitySession();
  const compiled = await compileCorrection({
    client,
    correction,
    policy: session.policy,
    selectedAction: goldenTrace[4],
    failureClass: classification.data.failure_class,
  });
  if (!compiled.ok) throw new Error(`correction compile failed: ${compiled.error.message}`);

  const review = buildImmunityReview(session, correction, compiled.data);
  const generatedBefore = review.before.results.at(-1);
  const generatedAfter = review.after.results.at(-1);

  console.log(`classifier_model=${classification.model}`);
  console.log(`classifier_usage=${JSON.stringify(classification.usage)}`);
  console.log(`failure_class=${classification.data.failure_class}`);
  console.log(`compiler_model=${compiled.model}`);
  console.log(`compiler_usage=${JSON.stringify(compiled.usage)}`);
  console.log(`patch_type=${compiled.data.candidate_patch.type}`);
  console.log(`before=${review.before.summary.passed}/${review.before.summary.total}`);
  console.log(`after=${review.after.summary.passed}/${review.after.summary.total}`);
  console.log(`generated_before=${generatedBefore?.passed ? "PASS" : "FAIL"}`);
  console.log(`generated_after=${generatedAfter?.passed ? "PASS" : "FAIL"}`);
  console.log(`regressions=${review.regressions}`);

  if (review.before.summary.passed !== 12 || review.before.summary.total !== 13) {
    throw new Error("expected 12/13 before patch");
  }
  if (review.after.summary.passed !== 13 || review.after.summary.total !== 13) {
    throw new Error("expected 13/13 after patch");
  }
  if (generatedBefore?.passed || !generatedAfter?.passed || review.regressions !== 0) {
    throw new Error("deterministic immunity proof failed");
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`live immunity smoke failed: ${message}`);
  process.exitCode = 1;
});
