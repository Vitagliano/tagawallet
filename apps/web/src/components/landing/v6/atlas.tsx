"use client";
import { useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/ui";

/* A chart. Ink a coast. A phantom island will not hold the ink. */

const COASTS = [
  { id: "eth", chain: "Plate I · Ethereum", addr: "0x4c1f…c2a8", d: "M40 80 C80 20 140 30 180 70 C210 100 160 130 90 120 C50 112 20 100 40 80 Z" },
  { id: "base", chain: "Plate II · Base", addr: "0x91aa…10e4", d: "M30 90 C70 40 150 50 190 90 C170 140 80 150 40 120 Z" },
  { id: "sol", chain: "Plate III · Solana", addr: "7KqP…m2nR", d: "M50 70 C120 20 200 60 180 110 C140 150 60 140 50 70 Z" },
];
const PHANTOM = { chain: "A sandbar", addr: "0x4c1f…c2a9", d: "M60 80 C100 50 160 55 170 90 C150 120 80 125 60 80 Z" };

export function AtlasLanding({ signedIn }: { signedIn: boolean }) {
  const [ink, setInk] = useState("");
  const [name, setName] = useState("");
  const [plates, setPlates] = useState<Record<string, boolean>>({ eth: false });
  const [runoff, setRunoff] = useState(false);

  function inkPlate(id: string) {
    if (!name) return;
    if (id === "ghost") {
      const real = plates.eth;
      if (real) { setRunoff(true); return; }
    }
    setPlates((p) => ({ ...p, [id]: true }));
  }

  return (
    <main className="min-h-screen pb-28" style={{ background: "#e6d3ae", color: "#1c2a33" }}>
      <header className="flex items-center justify-between px-5 py-4">
        <Link href="/" aria-label="TagAWallet home"><Logo className="text-lg" /></Link>
        <p className="text-[10px] uppercase tracking-[0.28em]">Chart room</p>
      </header>
      <section className="mx-auto w-full max-w-5xl px-5 pb-8 pt-2">
        <p className="text-xs uppercase tracking-[0.22em] text-[#6d4c2a]">Act I · The coast</p>
        <h1 className="mt-3 max-w-3xl text-5xl leading-[0.95] md:text-7xl" style={{ fontFamily: "Iowan Old Style, Palatino, Georgia, serif" }}>Ink a name onto the sea.</h1>
        <form className="mt-6 flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); if (ink.trim()) { setName(ink.trim()); setPlates({ eth: true }); } }}>
          <label>
            <span className="text-xs uppercase tracking-[0.16em]">Ink</span>
            <input value={ink} maxLength={24} onChange={(e) => setInk(e.target.value)} placeholder="Mina" className="mt-1 block w-52 border-b border-[#1c2a33]/40 bg-transparent py-2 text-2xl outline-none" style={{ fontFamily: "Iowan Old Style, Palatino, Georgia, serif", fontStyle: "italic" }} />
          </label>
          <button type="submit" className="bg-[#1e3a4c] px-4 py-2 text-sm text-[#e6d3ae]">Ink plate I</button>
        </form>
        <Chart coast={COASTS[0]} named={Boolean(plates.eth && name)} label={name} />
      </section>
      <section className="border-y border-[#1c2a33]/10 bg-[#d7c297]">
        <div className="mx-auto w-full max-w-5xl px-5 py-14">
          <p className="text-xs uppercase tracking-[0.22em] text-[#6d4c2a]">Act II · The next plates</p>
          <h2 className="mt-3 text-4xl" style={{ fontFamily: "Iowan Old Style, Palatino, Georgia, serif" }}>Carry the ink across chains.</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {COASTS.slice(1).map((c) => (
              <button key={c.id} type="button" onClick={() => inkPlate(c.id)} className="text-left" disabled={!name}>
                <Chart coast={c} named={Boolean(plates[c.id] && name)} label={name} />
                <span className="mt-1 block text-xs uppercase tracking-[0.14em]">{plates[c.id] ? "Inked" : "Press to carry the name"}</span>
              </button>
            ))}
          </div>
        </div>
      </section>
      <section className="mx-auto w-full max-w-3xl px-5 py-16">
        <p className="text-xs uppercase tracking-[0.22em] text-[#9c2b1a]">Act III · Phantom island</p>
        <h2 className="mt-3 text-4xl" style={{ fontFamily: "Iowan Old Style, Palatino, Georgia, serif" }}>The sandbar looks like the coast. The ink runs off.</h2>
        <button type="button" disabled={!name} onClick={() => inkPlate("ghost")} className="mt-4 text-left disabled:opacity-40">
          <Chart coast={PHANTOM} named={false} label="" runoff={runoff} />
        </button>
        <p className="mt-3 min-h-6 text-sm" role="status">{runoff ? `${name} stays on plate I. ${PHANTOM.addr} is not that coast.` : name ? "Try the sandbar. It will not keep the ink." : "Ink plate I first."}</p>
        <Link href={signedIn ? "/dashboard" : "/signup"} className="mt-6 inline-flex bg-[#1e3a4c] px-4 py-2.5 text-[#e6d3ae]">{signedIn ? "Open dashboard" : "Ink a chart. It's free."}</Link>
      </section>
    </main>
  );
}

function Chart({ coast, named, label, runoff }: { coast: { chain: string; addr: string; d: string }; named: boolean; label: string; runoff?: boolean }) {
  return (
    <figure className="mt-4">
      <svg viewBox="0 0 240 170" className="w-full max-w-md">
        <rect width="240" height="170" fill="#7ea0a8" />
        <path d={coast.d} fill={named ? "#1e3a4c" : "#c4b48a"} className={named ? "ink-in" : undefined} opacity={runoff ? 0.35 : 1} />
        {named && label && <text x="120" y="92" textAnchor="middle" fill="#f6edd8" fontFamily="Georgia, serif" fontStyle="italic" fontSize="18">{label}</text>}
        {runoff && <text x="120" y="100" textAnchor="middle" fill="#f6edd8" fontSize="12">ink ran off</text>}
      </svg>
      <figcaption className="mt-1 text-sm"><span>{coast.chain}</span> · <span className="addr">{coast.addr}</span></figcaption>
    </figure>
  );
}
