"use client";
import { useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/ui";

/* Sorting office. Envelopes fall into holes. A lookalike bounces. */

const HOLES = [
  { id: "mina", label: "Mina" },
  { id: "wind", label: "Northwind" },
  { id: "cold", label: "Cold" },
];
const MAIL = [
  { id: "a", addr: "0x4c1f…c2a8" },
  { id: "b", addr: "0x91aa…10e4" },
  { id: "c", addr: "7KqP…m2nR" },
];
const TWIN = { id: "x", addr: "0x4c1f…c2a9" };
const near = (a: string, b: string) => a.slice(0, 6) === b.slice(0, 6) && a !== b;

export function SlotsLanding({ signedIn }: { signedIn: boolean }) {
  const [box, setBox] = useState<Record<string, string>>({});
  const [hand, setHand] = useState<string | null>("a");
  const [bounce, setBounce] = useState("");

  function drop(hole: string) {
    const piece = hand === TWIN.id ? TWIN : MAIL.find((m) => m.id === hand);
    if (!piece) return;
    const clash = Object.entries(box).find(([id, h]) => h === hole && near((id === TWIN.id ? TWIN.addr : MAIL.find((m) => m.id === id)?.addr) ?? "", piece.addr));
    if (clash) { setBounce(piece.addr); return; }
    setBounce("");
    setBox((b) => ({ ...b, [piece.id]: hole }));
    setHand(null);
  }

  const placed = Object.entries(box);

  return (
    <main className="min-h-screen pb-28" style={{ background: "#c9a36a", color: "#2a1c0e" }}>
      <header className="flex items-center justify-between px-5 py-4">
        <Link href="/" aria-label="TagAWallet home"><Logo className="text-lg" /></Link>
        <p className="text-[10px] uppercase tracking-[0.28em]">Sorting office</p>
      </header>
      <section className="mx-auto w-full max-w-5xl px-5 pb-10 pt-2">
        <p className="text-xs uppercase tracking-[0.22em]">Act I · The wall</p>
        <h1 className="mt-3 max-w-3xl text-5xl leading-[0.95] md:text-7xl" style={{ fontFamily: "Iowan Old Style, Palatino, Georgia, serif" }}>Pick up a letter. Drop it in a hole.</h1>
        <div className="mt-8 flex flex-wrap gap-2">
          {[...MAIL, TWIN].map((m) => (
            <button key={m.id} type="button" onClick={() => setHand(m.id)} aria-pressed={hand === m.id} className={`border px-3 py-2 text-left ${hand === m.id ? "border-[#2a1c0e] bg-[#f3e6c8]" : "border-[#2a1c0e]/30 bg-[#ddc08a]"} ${bounce === m.addr ? "env-reject" : ""}`}>
              <span className="addr block text-sm">{m.addr}</span>
              <span className="text-[10px] uppercase tracking-[0.14em]">{box[m.id] ? `In ${box[m.id]}` : "On the bench"}</span>
            </button>
          ))}
        </div>
        <div className="mt-6 grid grid-cols-3 gap-3">
          {HOLES.map((h) => {
            const inside = placed.filter(([, hole]) => hole === h.id);
            return (
              <button key={h.id} type="button" onClick={() => drop(h.id)} className="min-h-36 bg-[#3a2918] p-3 text-left text-[#f3e6c8]">
                <span className="text-lg" style={{ fontFamily: "Iowan Old Style, Palatino, Georgia, serif" }}>{h.label}</span>
                <span className="mt-3 block space-y-1">
                  {inside.length === 0 && <span className="block text-xs text-[#f3e6c8]/50">Empty</span>}
                  {inside.map(([id]) => {
                    const addr = id === TWIN.id ? TWIN.addr : MAIL.find((m) => m.id === id)?.addr;
                    return <span key={id} className="env-drop addr block text-xs">{addr}</span>;
                  })}
                </span>
              </button>
            );
          })}
        </div>
      </section>
      <section className="bg-[#3a2918] text-[#f3e6c8]">
        <div className="mx-auto w-full max-w-5xl px-5 py-16">
          <p className="text-xs uppercase tracking-[0.22em] text-[#e7c56a]">Act II · The windows</p>
          <h2 className="mt-3 text-4xl" style={{ fontFamily: "Iowan Old Style, Palatino, Georgia, serif" }}>The holes travel with the clerk.</h2>
          <div className="mt-8 grid gap-3 md:grid-cols-3">
            {["Etherscan", "X", "A site you opened"].map((w) => (
              <article key={w} className="border border-[#e7c56a]/30 p-4">
                <p className="text-[10px] uppercase tracking-[0.16em] text-[#e7c56a]">{w}</p>
                <ul className="mt-4 space-y-2 text-sm">
                  {placed.length === 0 && <li className="text-[#f3e6c8]/50">Nothing sorted yet.</li>}
                  {placed.map(([id, hole]) => <li key={w + id}>{HOLES.find((h) => h.id === hole)?.label} · <span className="addr">{id === "x" ? TWIN.addr : MAIL.find((m) => m.id === id)?.addr}</span></li>)}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="mx-auto w-full max-w-3xl px-5 py-16">
        <p className="text-xs uppercase tracking-[0.22em]">Act III · Return to sender</p>
        <h2 className="mt-3 text-4xl" style={{ fontFamily: "Iowan Old Style, Palatino, Georgia, serif" }}>{bounce ? `${bounce} bounced.` : "The twin will not stay in Mina's hole."}</h2>
        <p className="mt-4 max-w-lg">Pick up 0x4c1f…c2a9 and aim it at Mina after the real letter is already there. Different chains may share a hole. A lookalike may not.</p>
        <Link href={signedIn ? "/dashboard" : "/signup"} className="mt-8 inline-flex bg-[#2a1c0e] px-4 py-2.5 text-[#f3e6c8]">{signedIn ? "Open dashboard" : "Sort a wallet. It's free."}</Link>
      </section>
    </main>
  );
}
