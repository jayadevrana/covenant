export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-slate-100">
      <section className="max-w-3xl space-y-6">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">
          Governance for tool-using agents
        </p>
        <h1 className="text-5xl font-semibold tracking-tight sm:text-7xl">
          Covenant
        </h1>
        <p className="max-w-2xl text-lg leading-8 text-slate-300">
          Compile plain-English rules into deterministic tool-call decisions,
          hash-linked receipts, and approval-gated policy improvements.
        </p>
        <p className="text-sm text-slate-400">
          Prototype safety layer. In-process enforcement is bypassable by code
          that does not route through it and is not proof that agents are
          universally safe.
        </p>
      </section>
    </main>
  );
}
