import Link from "next/link";

const loop = [
  { number: "01", title: "Compile", text: "Plain-English governance becomes a typed policy suggestion." },
  { number: "02", title: "Intercept", text: "A pure engine decides every proposed tool call before execution." },
  { number: "03", title: "Prove", text: "Hash-linked receipts preserve a tamper-evident export of the run." },
  { number: "04", title: "Immunize", text: "Human corrections become regression evals and approval-gated patches." },
];

export default function Home() {
  return (
    <main>
      <section className="relative overflow-hidden border-b border-white/8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(34,211,238,0.12),transparent_34%),radial-gradient(circle_at_20%_70%,rgba(139,92,246,0.09),transparent_30%)]" />
        <div className="relative mx-auto grid max-w-7xl gap-14 px-6 py-24 md:px-8 lg:grid-cols-[1.15fr_0.85fr] lg:py-32">
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">Governance and immunity for tool-using agents</p>
            <h1 className="mt-6 max-w-4xl text-5xl font-semibold leading-[0.98] tracking-[-0.045em] text-white sm:text-7xl">
              The safety layer that learns from every correction.
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-400">
              Covenant intercepts tool calls deterministically, records hash-linked receipts, and proves a human-approved policy patch prevents the same mistake without regressions.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link className="rounded-xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200" href="/run">Launch golden task</Link>
              <Link className="rounded-xl border border-white/15 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/5" href="/immunity">See the immunity proof</Link>
            </div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-5 shadow-2xl shadow-cyan-950/20">
            <div className="flex items-center justify-between border-b border-white/8 pb-4">
              <span className="font-mono text-xs text-slate-500">DETERMINISTIC DECISION</span>
              <span className="rounded-full border border-rose-300/30 bg-rose-300/10 px-2.5 py-1 text-[10px] font-bold text-rose-200">BLOCK</span>
            </div>
            <div className="space-y-4 py-5 font-mono text-xs leading-6 text-slate-400">
              <p><span className="text-slate-600">tool</span> send_email</p>
              <p><span className="text-slate-600">derived.external_domains</span> [partnerco.example]</p>
              <p><span className="text-slate-600">derived.contains_customer_data</span> true</p>
              <p><span className="text-slate-600">matched_rule</span> block-customer-data-external</p>
            </div>
            <div className="border-t border-white/8 pt-4 text-sm text-slate-300">The leak never reaches the sandbox tool.</div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20 md:px-8">
        <div className="grid gap-px overflow-hidden rounded-3xl border border-white/8 bg-white/8 md:grid-cols-4">
          {loop.map((item) => (
            <article className="bg-[#080b10] p-6" key={item.number}>
              <span className="font-mono text-xs text-cyan-300">{item.number}</span>
              <h2 className="mt-8 text-xl font-semibold">{item.title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-500">{item.text}</p>
            </article>
          ))}
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          <ScreenLink href="/run" label="Run control room" text="Launch the seeded task and watch every decision arrive live." />
          <ScreenLink href="/receipts" label="Receipt chain" text="Inspect, verify, and export the current run's evidence." />
          <ScreenLink href="/immunity" label="Immunity lab" text="Correct a decision and prove the patch before activation." />
        </div>
        <p className="mt-14 max-w-3xl text-xs leading-6 text-slate-600">
          Prototype safety layer. In-process enforcement is bypassable by code that does not route through it and is not proof that agents are universally safe. Receipts are tamper-evident within their export, not cryptographic signatures.
        </p>
      </section>
    </main>
  );
}

function ScreenLink({ href, label, text }: { href: string; label: string; text: string }) {
  return (
    <Link className="group rounded-2xl border border-white/8 bg-white/[0.02] p-5 transition hover:border-cyan-300/25 hover:bg-cyan-300/[0.03]" href={href}>
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{label}</h2>
        <span className="text-cyan-300 transition group-hover:translate-x-1">→</span>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-500">{text}</p>
    </Link>
  );
}
