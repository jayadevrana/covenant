import Link from "next/link";

const navigation = [
  { href: "/run", label: "Control room" },
  { href: "/receipts", label: "Receipts" },
  { href: "/immunity", label: "Immunity" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#05070a] text-slate-100">
      <header className="sticky top-0 z-40 border-b border-white/8 bg-[#05070a]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 md:px-8">
          <Link className="flex items-center gap-3" href="/">
            <span className="grid size-8 place-items-center rounded-lg border border-cyan-300/30 bg-cyan-300/10 font-mono text-xs font-bold text-cyan-200">CV</span>
            <span className="font-semibold tracking-tight">Covenant</span>
          </Link>
          <nav aria-label="Product screens" className="flex items-center gap-1">
            {navigation.map((item) => (
              <Link
                className="rounded-lg px-3 py-2 text-xs font-medium text-slate-400 transition hover:bg-white/5 hover:text-white md:text-sm"
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
