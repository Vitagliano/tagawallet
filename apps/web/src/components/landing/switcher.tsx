"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { GENERATIONS } from "./versions";

export function VersionSwitcher() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const gen = GENERATIONS.find((g) => path.startsWith(`/landing/${g.id}/`)) ?? GENERATIONS[0];
  const other = GENERATIONS[(GENERATIONS.indexOf(gen) + 1) % GENERATIONS.length];
  const current = gen.versions.find((v) => path === `/landing/${gen.id}/${v.slug}`);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2 text-xs">
      {open && (
        <nav aria-label="Landing page versions" className="flex max-h-[70vh] w-48 flex-col gap-0.5 overflow-y-auto rounded-2xl border border-line bg-card/90 p-1.5 shadow-lg backdrop-blur">
          <Link href="/landing" onClick={() => setOpen(false)} className="rounded-full px-2.5 py-1.5 text-muted hover:text-ink">All</Link>
          <Link href={`/landing/${other.id}/${other.versions[0].slug}`} onClick={() => setOpen(false)} title={`Go to ${other.id}`} className="addr rounded-full bg-wash px-2.5 py-1.5 font-medium">{gen.id}</Link>
          {gen.versions.map((v) => {
            const href = `/landing/${gen.id}/${v.slug}`;
            const on = path === href;
            return <Link key={v.slug} href={href} onClick={() => setOpen(false)} aria-current={on ? "page" : undefined} className={`rounded-full px-2.5 py-1.5 ${on ? "bg-accent font-medium text-accent-ink" : "hover:bg-wash"}`}>{v.name}</Link>;
          })}
        </nav>
      )}
      <button
        type="button"
        aria-expanded={open}
        aria-label="Switch landing page version"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full border border-line bg-card/90 px-3 py-2 font-medium shadow-lg backdrop-blur hover:bg-wash"
      >
        <span className="addr">{gen.id}</span>
        {current && <span className="text-muted">{current.name}</span>}
        <span aria-hidden>{open ? "×" : "⋯"}</span>
      </button>
    </div>
  );
}
