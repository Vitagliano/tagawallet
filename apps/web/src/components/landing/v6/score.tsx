"use client";
import { useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/ui";

/* A manuscript. Four staves, one title. A forged bar cannot steal it. */

const STAVES = [
  { id: "eth", name: "Ethereum", bits: ["4c", "1f", "c2", "a8"] },
  { id: "base", name: "Base", bits: ["91", "aa", "10", "e4"] },
  { id: "sol", name: "Solana", bits: ["7K", "qP", "m2", "nR"] },
  { id: "btc", name: "Bitcoin", bits: ["bc", "1q", "8k", "2p"] },
];
const FORGED = ["4c", "1f", "c2", "a9"];

function Staff({ label, bits, title, loose }: { label: string; bits: string[]; title: string; loose?: boolean }) {
  return (
    <figure className="border-b border-black/10 py-4">
      <figcaption className="text-[10px] uppercase tracking-[0.18em] text-[#6d675c]">{label}</figcaption>
      <svg viewBox="0 0 640 120" className="mt-1 w-full text-[#1c1915]" aria-hidden>
        {[0, 1, 2, 3, 4].map((i) => <line key={i} x1="8" x2="632" y1={36 + i * 12} y2={36 + i * 12} stroke="currentColor" strokeWidth="1" />)}
        {title && <text x="12" y="24" fontFamily="Georgia, serif" fontStyle="italic" fontSize="18">{title}</text>}
        {bits.map((b, i) => (
          <g key={b + i} className={loose ? "env-reject" : undefined}>
            <ellipse cx={90 + i * 120} cy={loose ? 18 : 60} rx="11" ry="8" fill="currentColor" />
            <text x={90 + i * 120} y={loose ? 8 : 96} textAnchor="middle" fontSize="11" fontFamily="ui-monospace, monospace">{b}</text>
          </g>
        ))}
      </svg>
    </figure>
  );
}

export function ScoreLanding({ signedIn }: { signedIn: boolean }) {
  const [title, setTitle] = useState("");
  const [set, setSet] = useState("");
  const [stolen, setStolen] = useState(false);

  return (
    <main className="min-h-screen pb-28" style={{ background: "#f6f1e6", color: "#1c1915" }}>
      <header className="flex items-center justify-between px-5 py-4">
        <Link href="/" aria-label="TagAWallet home"><Logo className="text-lg" /></Link>
        <p className="text-[10px] uppercase tracking-[0.28em]">Manuscript</p>
      </header>
      <section className="mx-auto w-full max-w-3xl px-5 pb-8 pt-4">
        <p className="text-xs uppercase tracking-[0.22em] text-[#8a5a00]">Act I · The motif</p>
        <h1 className="mt-3 text-5xl leading-[0.95] md:text-7xl" style={{ fontFamily: "Iowan Old Style, Palatino, Georgia, serif" }}>Title the tune.</h1>
        <form className="mt-6 flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); if (title.trim()) setSet(title.trim()); }}>
          <label className="block">
            <span className="text-xs uppercase tracking-[0.16em] text-[#6d675c]">Above the staff</span>
            <input value={title} maxLength={28} onChange={(e) => setTitle(e.target.value)} placeholder="Mina" className="mt-1 block w-56 border-b border-black/30 bg-transparent py-2 text-2xl outline-none" style={{ fontFamily: "Iowan Old Style, Palatino, Georgia, serif", fontStyle: "italic" }} />
          </label>
          <button type="submit" className="bg-[#1c1915] px-4 py-2 text-sm text-[#f6f1e6]">Set the title</button>
        </form>
        <Staff label="Ethereum · 0x4c1f…c2a8" bits={STAVES[0].bits} title={set} />
      </section>
      <section className="border-y border-black/10 bg-[#efe6d4]">
        <div className="mx-auto w-full max-w-3xl px-5 py-14">
          <p className="text-xs uppercase tracking-[0.22em] text-[#8a5a00]">Act II · The parts</p>
          <h2 className="mt-3 text-4xl" style={{ fontFamily: "Iowan Old Style, Palatino, Georgia, serif" }}>One title, four parts.</h2>
          <p className="mt-3 max-w-lg text-[#6d675c]">{set ? `Every chain that is actually hers carries “${set}”.` : "Title the motif and the other parts inherit it."}</p>
          {STAVES.slice(1).map((s) => <Staff key={s.id} label={`${s.name}`} bits={s.bits} title={set} />)}
        </div>
      </section>
      <section className="mx-auto w-full max-w-3xl px-5 py-16">
        <p className="text-xs uppercase tracking-[0.22em] text-[#9c2b1a]">Act III · The forged bar</p>
        <h2 className="mt-3 text-4xl" style={{ fontFamily: "Iowan Old Style, Palatino, Georgia, serif" }}>One note off, and the title will not sit.</h2>
        <Staff label="0x4c1f…c2a9" bits={FORGED} title={stolen ? "" : ""} loose={stolen} />
        <button type="button" disabled={!set} onClick={() => setStolen(true)} className="mt-2 border border-[#9c2b1a] px-4 py-2 text-sm disabled:opacity-40">Steal “{set || "the title"}”</button>
        {stolen && <p className="mt-4 text-sm text-[#9c2b1a]" role="status">The notes left the staff. {set} stays on the real motif.</p>}
        <Link href={signedIn ? "/dashboard" : "/signup"} className="mt-8 inline-flex bg-[#1c1915] px-4 py-2.5 text-[#f6f1e6]">{signedIn ? "Open dashboard" : "Title a wallet. It's free."}</Link>
      </section>
    </main>
  );
}
