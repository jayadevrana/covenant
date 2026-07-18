import { seedDerivationContext } from "../../data/seed";
import { evaluatePolicy } from "../engine";
import type { EvalResult, GeneratedEval, Policy } from "../schemas";

export const EVAL_TIMESTAMP = "2026-07-18T00:00:00.000Z";

export function runEval(generatedEval: GeneratedEval, policy: Policy): EvalResult {
  const per_expectation = generatedEval.expectations.map((expectation) => {
    const action = generatedEval.trace[expectation.action_index];
    const actual = action
      ? evaluatePolicy(policy, action, {
          timestamp: EVAL_TIMESTAMP,
          derivationContext: seedDerivationContext,
        }).verdict
      : "block";
    return {
      action_index: expectation.action_index,
      expected: expectation.expected_verdict,
      actual,
      pass: actual === expectation.expected_verdict,
    };
  });
  return {
    eval_id: generatedEval.id,
    policy_version: policy.version,
    passed: per_expectation.every((expectation) => expectation.pass),
    per_expectation,
  };
}

export function runEvalSuite(evals: readonly GeneratedEval[], policy: Policy): EvalResult[] {
  return evals.map((generatedEval) => runEval(generatedEval, policy));
}

export function summarizeEvalResults(results: readonly EvalResult[]) {
  const passed = results.filter((result) => result.passed).length;
  return { passed, total: results.length, failed: results.length - passed };
}
