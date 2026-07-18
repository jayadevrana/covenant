import { seedEvals } from "../../data/evals";
import { seedPolicy } from "../../data/seed";
import type { CorrectionCompilation } from "../ai";
import type { Correction, EvalResult, GeneratedEval, Patch, Policy } from "../schemas";
import { runEvalSuite, summarizeEvalResults } from "./evals";
import { approvePatch, previewPatch, rejectPatch } from "./patches";

export interface ImmunityReview {
  correction: Correction;
  compilation: CorrectionCompilation;
  before: { results: EvalResult[]; summary: ReturnType<typeof summarizeEvalResults> };
  after: { results: EvalResult[]; summary: ReturnType<typeof summarizeEvalResults> };
  regressions: number;
  proposedPolicyVersion: number;
}

export interface ImmunitySession {
  policy: Policy;
  evals: GeneratedEval[];
  patches: Patch[];
  pending: ImmunityReview | null;
}

const globalSessions = globalThis as typeof globalThis & {
  covenantImmunitySessions?: Map<string, ImmunitySession>;
};
const sessions = globalSessions.covenantImmunitySessions ?? new Map<string, ImmunitySession>();
globalSessions.covenantImmunitySessions = sessions;

export function createImmunitySession(): ImmunitySession {
  return {
    policy: structuredClone(seedPolicy),
    evals: structuredClone(seedEvals),
    patches: [],
    pending: null,
  };
}

export function getImmunitySession(runId: string): ImmunitySession {
  const existing = sessions.get(runId);
  if (existing) return existing;
  const created = createImmunitySession();
  sessions.set(runId, created);
  return created;
}

export function buildImmunityReview(
  session: ImmunitySession,
  correction: Correction,
  compilation: CorrectionCompilation,
): ImmunityReview {
  const evals = [...session.evals, compilation.generated_eval];
  const beforeResults = runEvalSuite(evals, session.policy);
  const proposedPolicy = previewPatch(session.policy, compilation.candidate_patch);
  const afterResults = runEvalSuite(evals, proposedPolicy);
  const seedIds = new Set(session.evals.map((generatedEval) => generatedEval.id));
  const regressions = afterResults.filter(
    (result) => seedIds.has(result.eval_id) && !result.passed,
  ).length;
  const review: ImmunityReview = {
    correction,
    compilation,
    before: { results: beforeResults, summary: summarizeEvalResults(beforeResults) },
    after: { results: afterResults, summary: summarizeEvalResults(afterResults) },
    regressions,
    proposedPolicyVersion: proposedPolicy.version,
  };
  session.pending = review;
  return review;
}

export function decideImmunityReview(
  session: ImmunitySession,
  decision: "approve" | "reject",
) {
  if (!session.pending) throw new Error("No pending immunity review");
  const pending = session.pending;
  if (decision === "reject") {
    const rejected = rejectPatch(session.policy, pending.compilation.candidate_patch);
    session.patches.push(rejected.patch);
    session.pending = null;
    const results = runEvalSuite(session.evals, session.policy);
    return {
      decision,
      policy: session.policy,
      patch: rejected.patch,
      results,
      summary: summarizeEvalResults(results),
    };
  }

  const approved = approvePatch(session.policy, pending.compilation.candidate_patch);
  session.policy = approved.policy;
  session.patches.push(approved.patch);
  session.evals.push(pending.compilation.generated_eval);
  session.pending = null;
  const results = runEvalSuite(session.evals, session.policy);
  return {
    decision,
    policy: session.policy,
    patch: approved.patch,
    results,
    summary: summarizeEvalResults(results),
  };
}

export function clearImmunitySessionsForTests(): void {
  sessions.clear();
}
