"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type { ImmunityReview } from "../../lib/immunity";
import type { EvalResult, Patch, Policy, ReceiptEvent } from "../../lib/schemas";
import { fetchWithTimeout } from "./fetch-with-timeout";
import { useLatestRun } from "./use-latest-run";

const DEFAULT_CORRECTION =
  "It should have sent the partner a redacted summary with customer data removed.";

interface DecisionResult {
  decision: "approve" | "reject";
  policy: Policy;
  patch: Patch;
  results: EvalResult[];
  summary: { passed: number; total: number; failed: number };
}

interface VisibleError {
  message: string;
  rawOutput?: string;
}

export function ImmunityScreen() {
  const { run, setRun, loading, loadError } = useLatestRun();
  const [selectedActionId, setSelectedActionId] = useState("");
  const [correction, setCorrection] = useState(DEFAULT_CORRECTION);
  const [review, setReview] = useState<ImmunityReview | null>(null);
  const [decisionResult, setDecisionResult] = useState<DecisionResult | null>(null);
  const [compilerProvenance, setCompilerProvenance] = useState("FIXTURE");
  const [classificationProvenance, setClassificationProvenance] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<VisibleError | null>(null);

  const decisions = useMemo(
    () => run?.timeline.filter((entry) => entry.decision && entry.action) ?? [],
    [run?.timeline],
  );

  useEffect(() => {
    if (selectedActionId || decisions.length === 0) return;
    const preferred = [...decisions].reverse().find((entry) => entry.decision?.verdict === "block") ?? decisions[0];
    setSelectedActionId(preferred.action?.id ?? "");
  }, [decisions, selectedActionId]);

  async function compileReview() {
    if (!run || !selectedActionId || !correction.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetchWithTimeout("/api/correction/compile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          runId: run.id,
          actionId: selectedActionId,
          whatShouldHaveHappened: correction,
        }),
      });
      const payload = (await response.json()) as {
        review?: ImmunityReview;
        compilerProvenance?: string;
        classificationProvenance?: string | null;
        receipts?: ReceiptEvent[];
        error?: string | { message?: string; rawOutput?: string };
      };
      if (!response.ok || !payload.review) {
        setError(typeof payload.error === "string"
          ? { message: payload.error }
          : {
              message: payload.error?.message ?? "Correction compile failed",
              rawOutput: payload.error?.rawOutput,
            });
        return;
      }
      setReview(payload.review);
      setCompilerProvenance(payload.compilerProvenance ?? "FIXTURE");
      setClassificationProvenance(payload.classificationProvenance ?? null);
      setDecisionResult(null);
      if (payload.receipts) setRun({ ...run, receipts: payload.receipts });
    } catch (caught) {
      setError({ message: caught instanceof Error ? caught.message : String(caught) });
    } finally {
      setBusy(false);
    }
  }

  async function decide(decision: "approve" | "reject") {
    if (!run) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetchWithTimeout("/api/correction/decision", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ runId: run.id, decision }),
      });
      const payload = (await response.json()) as {
        result?: DecisionResult;
        receipts?: ReceiptEvent[];
        error?: string;
      };
      if (!response.ok || !payload.result) throw new Error(payload.error ?? "Patch decision failed");
      setDecisionResult(payload.result);
      if (payload.receipts) setRun({ ...run, policy: payload.result.policy, receipts: payload.receipts });
    } catch (caught) {
      setError({ message: caught instanceof Error ? caught.message : String(caught) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-12 md:px-8 md:py-16">
      <header className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">03 / Immunize</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">Correction immunity lab</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-400">Convert one human correction into a generated eval and candidate patch, preview the deterministic proof, then choose whether policy changes.</p>
        </div>
        {run ? <span className="rounded-full border border-emerald-300/25 bg-emerald-300/5 px-3 py-1.5 font-mono text-[10px] font-semibold text-emerald-200">{review ? compilerProvenance : run.mode === "fixture" ? "FIXTURE" : `LIVE · ${run.modelId}`}</span> : null}
      </header>

      {error ? (
        <div role="alert" className="mt-8 rounded-xl border border-rose-300/25 bg-rose-300/10 p-4 text-sm text-rose-100">
          <p>{error.message}</p>
          {error.rawOutput ? <details className="mt-3"><summary className="cursor-pointer font-semibold">Inspect invalid model output</summary><pre className="mt-3 max-h-56 overflow-auto rounded-lg bg-black/35 p-3 font-mono text-xs text-rose-100">{error.rawOutput}</pre></details> : null}
        </div>
      ) : loadError ? <div role="alert" className="mt-8 rounded-xl border border-rose-300/25 bg-rose-300/10 p-4 text-sm text-rose-100">{loadError}</div> : null}
      {loading ? <Empty text="Loading the latest run…" /> : null}
      {!loading && (!run || decisions.length === 0) ? (
        <section className="mt-10 rounded-2xl border border-dashed border-white/10 p-12 text-center">
          <p className="text-sm text-slate-400">Complete a run first so there is a decided action to correct.</p>
          <Link className="mt-5 inline-block rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-semibold text-slate-950" href="/run">Open control room</Link>
        </section>
      ) : null}

      {run && decisions.length > 0 ? (
        <div className="mt-10 grid gap-6 xl:grid-cols-[22rem_1fr]">
          <aside className="h-fit rounded-2xl border border-white/10 bg-white/[0.02] p-5 xl:sticky xl:top-24">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Human correction</p>
            <label className="mt-5 block text-xs font-medium text-slate-400" htmlFor="decision-step">Decided step</label>
            <select className="mt-2 w-full rounded-xl border border-white/10 bg-[#090c11] p-3 text-sm" id="decision-step" onChange={(event) => setSelectedActionId(event.target.value)} value={selectedActionId}>
              <option value="">Select a decision</option>
              {decisions.map((entry) => <option key={entry.action?.id} value={entry.action?.id}>{entry.action?.tool} · {entry.decision?.verdict}</option>)}
            </select>
            <label className="mt-5 block text-xs font-medium text-slate-400" htmlFor="correction">What should have happened?</label>
            <textarea className="mt-2 min-h-40 w-full resize-none rounded-xl border border-white/10 bg-[#090c11] p-3 text-sm leading-6 text-slate-200" id="correction" onChange={(event) => setCorrection(event.target.value)} value={correction} />
            <button className="mt-4 w-full rounded-xl bg-emerald-300 px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50" disabled={busy || !selectedActionId || !correction.trim()} onClick={() => void compileReview()}>{busy ? "Compiling…" : "Generate eval + patch"}</button>
            <p className="mt-4 text-xs leading-5 text-slate-400">Compiler output is a suggestion. Only deterministic replay verifies it, and only your approval activates it.</p>
          </aside>

          <section className="min-w-0 space-y-6">
            {!review ? <Empty text="Submit the correction to generate a reviewable eval and patch diff." /> : null}
            {review ? (
              <>
                <section className="rounded-2xl border border-violet-300/15 bg-violet-300/[0.025] p-5 md:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-300">Compiler suggestion</p>
                      <h2 className="mt-3 text-2xl font-semibold">{review.compilation.generated_eval.title}</h2>
                    </div>
                    <div className="flex flex-wrap gap-2 font-mono text-[9px] font-semibold text-violet-200">
                      <span className="rounded-full border border-violet-300/25 px-2.5 py-1">{compilerProvenance}</span>
                      {classificationProvenance ? <span className="rounded-full border border-violet-300/25 px-2.5 py-1">CLASSIFIED · {classificationProvenance}</span> : null}
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-slate-300">{review.compilation.explanation}</p>
                  <div className="mt-5 rounded-xl border border-emerald-300/15 bg-black/25 p-4">
                    <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-300">Proposed policy diff</p>
                    <p className="mt-3 text-sm text-slate-300">+ {review.compilation.candidate_patch.diff_summary}</p>
                    <pre className="mt-4 max-h-80 overflow-auto rounded-lg border border-white/6 bg-black/25 p-4 text-[10px] leading-5 text-slate-400">{JSON.stringify(review.compilation.candidate_patch.rule, null, 2)}</pre>
                  </div>
                </section>

                <section className="grid gap-4 md:grid-cols-2">
                  <ProofCard label="Before patch" summary={review.before.summary} before />
                  <ProofCard label="After patch preview" summary={review.after.summary} />
                </section>

                <div className={`rounded-xl border p-4 text-sm ${review.regressions === 0 ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-100" : "border-rose-300/25 bg-rose-300/10 text-rose-100"}`}>
                  {review.regressions === 0 ? "Zero regressions across all 12 seed evals." : `${review.regressions} prior regression(s) detected.`}
                </div>

                <RegressionGrid before={review.before.results} after={review.after.results} />

                {!decisionResult ? (
                  <div className="flex justify-end gap-3 rounded-2xl border border-white/8 bg-white/[0.02] p-5">
                    <button className="rounded-xl border border-white/15 px-4 py-2.5 text-sm" disabled={busy} onClick={() => void decide("reject")}>Reject patch</button>
                    <button className="rounded-xl bg-emerald-300 px-4 py-2.5 text-sm font-semibold text-slate-950" disabled={busy} onClick={() => void decide("approve")}>Approve + activate v{review.proposedPolicyVersion}</button>
                  </div>
                ) : (
                  <div className={`rounded-2xl border p-5 text-sm ${decisionResult.decision === "approve" ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-100" : "border-slate-500/25 bg-slate-500/10 text-slate-200"}`}>
                    {decisionResult.decision === "approve"
                      ? `Approved. Policy v${decisionResult.policy.version} is active and ${decisionResult.summary.passed}/${decisionResult.summary.total} evals pass.`
                      : `Rejected. Policy remains v${decisionResult.policy.version}; no generated eval or rule was activated.`}
                  </div>
                )}
              </>
            ) : null}
          </section>
        </div>
      ) : null}
    </main>
  );
}

function ProofCard({ label, summary, before = false }: { label: string; summary: { passed: number; total: number; failed: number }; before?: boolean }) {
  return <div className={`rounded-2xl border p-6 ${before ? "border-rose-300/20 bg-rose-300/[0.055]" : "border-emerald-300/20 bg-emerald-300/[0.055]"}`}><p className={`font-mono text-[10px] font-semibold uppercase tracking-[0.18em] ${before ? "text-rose-300" : "text-emerald-300"}`}>{label}</p><div className="mt-4 flex items-end gap-3"><strong className="text-5xl tracking-tight">{summary.passed}/{summary.total}</strong><span className="pb-1 text-sm text-slate-400">passing</span></div><p className="mt-3 text-xs text-slate-400">{summary.failed ? `${summary.failed} generated case failing.` : "Generated case fixed. All cases green."}</p></div>;
}

function RegressionGrid({ before, after }: { before: EvalResult[]; after: EvalResult[] }) {
  const afterById = new Map(after.map((result) => [result.eval_id, result]));
  return (
    <section className="overflow-hidden rounded-2xl border border-white/10">
      <div className="grid grid-cols-[1fr_5rem_5rem] bg-white/[0.035] px-5 py-3 font-mono text-[9px] uppercase tracking-wider text-slate-400"><span>Regression eval</span><span>Before</span><span>After</span></div>
      <div className="max-h-[28rem] overflow-auto">
        {before.map((result) => {
          const next = afterById.get(result.eval_id);
          return <div className="grid grid-cols-[1fr_5rem_5rem] border-t border-white/6 px-5 py-3 text-xs" key={result.eval_id}><span className="truncate pr-4 text-slate-400">{result.eval_id}</span><Status pass={result.passed} /><Status pass={Boolean(next?.passed)} /></div>;
        })}
      </div>
    </section>
  );
}

function Status({ pass }: { pass: boolean }) {
  return <span className={pass ? "font-semibold text-emerald-300" : "font-semibold text-rose-300"}>{pass ? "PASS" : "FAIL"}</span>;
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-white/10 p-12 text-center text-sm text-slate-400">{text}</div>;
}
