"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { AgentRun, TimelineEntry } from "../../lib/agent";
import { useLatestRun } from "./use-latest-run";

const GOLDEN_TASK =
  "Email each customer affected by the July 12 outage an apology with their usage summary, and send the full incident report to our partner.";

async function postRun(url: string, body: object): Promise<AgentRun> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as { run?: AgentRun; error?: string };
  if (!response.ok || !payload.run) throw new Error(payload.error ?? "Request failed");
  return payload.run;
}

export function ControlRoom() {
  const { run, setRun, loading, loadError } = useLatestRun();
  const [task, setTask] = useState(GOLDEN_TASK);
  const [busy, setBusy] = useState(false);
  const [autoRun, setAutoRun] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const approveButtonRef = useRef<HTMLButtonElement>(null);

  const decisions = useMemo(
    () => run?.timeline.filter((entry) => entry.decision) ?? [],
    [run?.timeline],
  );

  const advance = useCallback(async () => {
    if (!run || run.status !== "running" || busy) return;
    setBusy(true);
    try {
      setRun(await postRun("/api/run/step", { runId: run.id }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setAutoRun(false);
    } finally {
      setBusy(false);
    }
  }, [busy, run, setRun]);

  useEffect(() => {
    if (!autoRun || !run || run.status !== "running" || busy) return;
    const timer = window.setTimeout(() => void advance(), 300);
    return () => window.clearTimeout(timer);
  }, [advance, autoRun, busy, run]);

  useEffect(() => {
    if (run?.status === "awaiting_approval") approveButtonRef.current?.focus();
  }, [run?.status]);

  async function start(mode: "fixture" | "live") {
    setBusy(true);
    setError(null);
    try {
      setRun(await postRun("/api/run/start", { task, mode }));
      setAutoRun(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }

  async function decideApproval(approved: boolean) {
    if (!run) return;
    setBusy(true);
    setError(null);
    try {
      setRun(await postRun("/api/run/approval", { runId: run.id, approved }));
      setAutoRun(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-12 md:px-8 md:py-16">
      <ScreenHeader
        eyebrow="01 / Intercept"
        title="Run control room"
        description="Launch one task. Each client request advances exactly one model turn, and every proposed tool call stops at the deterministic engine before execution."
      />

      <section className="mt-10 grid gap-6 lg:grid-cols-[22rem_1fr]">
        <aside className="h-fit rounded-2xl border border-white/10 bg-white/[0.025] p-5 lg:sticky lg:top-24">
          <label className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400" htmlFor="task">Task</label>
          <textarea
            className="mt-3 min-h-48 w-full resize-none rounded-xl border border-white/10 bg-black/30 p-4 text-sm leading-6 text-slate-200"
            id="task"
            onChange={(event) => setTask(event.target.value)}
            value={task}
          />
          <div className="mt-4 grid gap-2">
            <button className="rounded-xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50" disabled={busy || !task.trim()} onClick={() => void start("fixture")}>{busy ? "Starting…" : "Run seeded fixture"}</button>
            <button className="rounded-xl border border-white/15 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50" disabled={busy || !task.trim()} onClick={() => void start("live")}>Run live model</button>
          </div>
          <p className="mt-4 text-xs leading-5 text-slate-400">Fixture mode makes no model call. Live mode uses the server key and labels the resolved model ID.</p>
        </aside>

        <section aria-busy={busy} aria-live="polite" className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.018]">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/8 px-5 py-4">
            <div>
              <p className="text-sm font-semibold">Live interception timeline</p>
              <p className="mt-1 text-xs text-slate-400">Model suggestion → deterministic decision → sandbox result</p>
            </div>
            {run ? <ProvenanceBadge run={run} /> : null}
          </div>

          {(error ?? loadError) ? <div role="alert" className="m-5 rounded-xl border border-rose-300/25 bg-rose-300/10 p-4 text-sm text-rose-100">{error ?? loadError}</div> : null}
          {loading ? <EmptyState text="Loading the latest run…" /> : null}
          {!loading && !run ? <EmptyState text="No run yet. Launch the seeded fixture to begin." /> : null}

          {run ? (
            <>
              <div className="grid gap-px border-b border-white/8 bg-white/8 sm:grid-cols-4">
                <Metric label="Status" value={run.status.replace("_", " ")} />
                <Metric label="Model turns" value={String(run.turn)} />
                <Metric label="Decisions" value={String(decisions.length)} />
                <Metric label="Executed sends" value={String(run.world.outbox.length)} />
              </div>
              <ol className="space-y-3 p-5">
                {run.timeline.map((entry) => <TimelineCard entry={entry} key={`${entry.seq}-${entry.type}`} />)}
              </ol>
              {run.status === "completed" ? (
                <div className="flex flex-wrap gap-3 border-t border-white/8 p-5">
                  <Link className="rounded-xl bg-violet-300 px-4 py-2.5 text-sm font-semibold text-slate-950" href="/receipts">Inspect receipt chain</Link>
                  <Link className="rounded-xl border border-cyan-300/25 px-4 py-2.5 text-sm font-semibold text-cyan-100" href="/immunity">Correct a decision</Link>
                </div>
              ) : null}
            </>
          ) : null}
        </section>
      </section>

      {run?.status === "awaiting_approval" && run.pendingAction ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-5 backdrop-blur-sm">
          <div aria-labelledby="approval-title" aria-modal="true" className="w-full max-w-xl rounded-3xl border border-amber-300/30 bg-[#0b0e13] p-6 shadow-2xl" role="dialog">
            <div className="flex items-center justify-between gap-4">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-200">Human checkpoint</p>
              <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-2.5 py-1 text-[10px] font-bold text-amber-100">REQUIRE APPROVAL</span>
            </div>
            <h2 className="mt-4 text-2xl font-semibold" id="approval-title">Approve bulk sandbox send?</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">The engine matched the more-than-five-recipient rule. The tool has not executed.</p>
            <pre className="mt-5 max-h-64 overflow-auto rounded-xl border border-white/8 bg-black/30 p-4 text-xs text-slate-400">{JSON.stringify(run.pendingAction.args, null, 2)}</pre>
            <div className="mt-6 flex justify-end gap-3">
              <button className="rounded-xl border border-white/15 px-4 py-2.5 text-sm" onClick={() => void decideApproval(false)}>Deny</button>
              <button className="rounded-xl bg-amber-300 px-4 py-2.5 text-sm font-semibold text-slate-950" onClick={() => void decideApproval(true)} ref={approveButtonRef}>Approve sandbox action</button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function TimelineCard({ entry }: { entry: TimelineEntry }) {
  const verdict = entry.decision?.verdict;
  const verdictStyle = verdict === "block"
    ? "border-rose-300/30 bg-rose-300/10 text-rose-200"
    : verdict === "require_approval"
      ? "border-amber-300/30 bg-amber-300/10 text-amber-100"
      : "border-emerald-300/30 bg-emerald-300/10 text-emerald-100";
  return (
    <li className="rounded-xl border border-white/8 bg-black/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="font-mono text-[10px] text-slate-400">{String(entry.seq).padStart(2, "0")}</span>
          <p className="truncate text-sm font-medium">{entry.title}</p>
          {verdict ? <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${verdictStyle}`}>{verdict.replace("_", " ")}</span> : null}
        </div>
        <span className="font-mono text-[9px] font-semibold text-cyan-300">{entry.provenance}</span>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-400">{entry.detail}</p>
      {entry.action ? <details className="mt-3"><summary className="cursor-pointer text-xs text-slate-400">Tool arguments</summary><pre className="mt-2 overflow-auto rounded-lg bg-black/30 p-3 text-[11px] text-slate-400">{JSON.stringify(entry.action.args, null, 2)}</pre></details> : null}
    </li>
  );
}

function ProvenanceBadge({ run }: { run: AgentRun }) {
  return <span className="rounded-full border border-cyan-300/25 bg-cyan-300/5 px-2.5 py-1 font-mono text-[10px] font-semibold text-cyan-200">{run.mode === "fixture" ? "FIXTURE" : `LIVE · ${run.modelId}`}</span>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="bg-[#090c11] px-5 py-4"><p className="font-mono text-[9px] uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1.5 capitalize text-sm text-slate-200">{value}</p></div>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="m-5 rounded-xl border border-dashed border-white/10 p-12 text-center text-sm text-slate-400">{text}</div>;
}

function ScreenHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <header><p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">{eyebrow}</p><h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">{title}</h1><p className="mt-4 max-w-3xl text-base leading-7 text-slate-400">{description}</p></header>;
}
