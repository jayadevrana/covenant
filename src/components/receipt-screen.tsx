"use client";

import Link from "next/link";
import { useState } from "react";

import {
  createReceiptExport,
  verifyReceiptChain,
  type ReceiptVerification,
} from "../../lib/receipts";
import { useLatestRun } from "./use-latest-run";

export function ReceiptScreen() {
  const { run, loading, loadError, refresh } = useLatestRun();
  const [verification, setVerification] = useState<ReceiptVerification | null>(null);

  function exportJson() {
    if (!run) return;
    const blob = new Blob([JSON.stringify(createReceiptExport(run.receipts), null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `covenant-receipts-${run.id}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const head = run?.receipts.at(-1)?.payload_hash ?? "0".repeat(64);

  return (
    <main className="mx-auto max-w-7xl px-6 py-12 md:px-8 md:py-16">
      <header className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-violet-300">02 / Prove</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">Receipt chain</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-400">Read every run event, verify its SHA-256 link in this browser, and export the evidence as JSON.</p>
        </div>
        {run ? <span className="rounded-full border border-violet-300/25 bg-violet-300/5 px-3 py-1.5 font-mono text-[10px] font-semibold text-violet-200">{run.mode === "fixture" ? "FIXTURE" : `LIVE · ${run.modelId}`}</span> : null}
      </header>

      {loadError ? <div role="alert" className="mt-8 rounded-xl border border-rose-300/25 bg-rose-300/10 p-4 text-sm text-rose-100">{loadError}</div> : null}
      {loading ? <Empty /> : null}
      {!loading && !run ? (
        <section className="mt-10 rounded-2xl border border-dashed border-white/10 p-12 text-center">
          <p className="text-sm text-slate-400">No run is available yet.</p>
          <Link className="mt-5 inline-block rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-semibold text-slate-950" href="/run">Launch the golden task</Link>
        </section>
      ) : null}

      {run ? (
        <>
          <section className="mt-10 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
            <div className="grid gap-px bg-white/8 md:grid-cols-[1fr_12rem_12rem]">
              <div className="min-w-0 bg-[#090c11] p-5">
                <p className="font-mono text-[9px] uppercase tracking-wider text-slate-400">Chain head</p>
                <code className="mt-2 block truncate text-xs text-violet-200">{head}</code>
              </div>
              <div className="bg-[#090c11] p-5"><p className="font-mono text-[9px] uppercase tracking-wider text-slate-400">Events</p><p className="mt-2 text-sm">{run.receipts.length}</p></div>
              <div className="bg-[#090c11] p-5"><p className="font-mono text-[9px] uppercase tracking-wider text-slate-400">Run</p><p className="mt-2 truncate text-sm">{run.id}</p></div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/8 p-5">
              <p className="max-w-2xl text-xs leading-5 text-slate-400">Tamper-evident within this export. These hashes are not cryptographic signatures and do not prove events outside the routed sandbox path.</p>
              <div className="flex gap-2">
                <button className="rounded-xl border border-violet-300/25 px-4 py-2.5 text-sm font-semibold text-violet-100" onClick={() => setVerification(verifyReceiptChain(run.receipts))}>Verify chain</button>
                <button className="rounded-xl bg-violet-300 px-4 py-2.5 text-sm font-semibold text-slate-950" onClick={exportJson}>Export JSON</button>
                <button aria-label="Refresh receipts" className="rounded-xl border border-white/10 px-3 py-2.5 text-sm text-slate-400" onClick={() => void refresh()}>↻</button>
              </div>
            </div>
            {verification ? (
              <div className={`mx-5 mb-5 rounded-xl border p-4 text-sm ${verification.valid ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-100" : "border-rose-300/25 bg-rose-300/10 text-rose-100"}`} role="status">
                {verification.valid ? `Verified ${verification.checked} events. Chain intact.` : `Verification failed: ${verification.error}`}
              </div>
            ) : null}
          </section>

          <section className="mt-6 overflow-hidden rounded-2xl border border-white/10">
            <div className="grid grid-cols-[3rem_10rem_1fr] bg-white/[0.035] px-5 py-3 font-mono text-[9px] uppercase tracking-wider text-slate-400">
              <span>Seq</span><span>Event</span><span>Hash and payload</span>
            </div>
            <ol>
              {run.receipts.map((receipt) => (
                <li className="grid grid-cols-[3rem_10rem_1fr] border-t border-white/6 px-5 py-4 text-xs" key={receipt.payload_hash}>
                  <span className="font-mono text-slate-400">{String(receipt.seq).padStart(2, "0")}</span>
                  <span className="text-slate-300">{receipt.type}</span>
                  <div className="min-w-0">
                    <code className="block truncate text-violet-300/70">{receipt.payload_hash}</code>
                    <details className="mt-2"><summary className="cursor-pointer text-slate-400">Read event payload</summary><pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-black/30 p-3 text-[10px] leading-5 text-slate-400">{JSON.stringify(receipt.payload, null, 2)}</pre></details>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </>
      ) : null}
    </main>
  );
}

function Empty() {
  return <div className="mt-10 rounded-2xl border border-dashed border-white/10 p-12 text-center text-sm text-slate-400">Loading the latest receipt chain…</div>;
}
