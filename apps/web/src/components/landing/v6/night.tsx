"use client";
import { useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/ui";

/* Night audit. The book is private. The lobby plaque will not take it. */

const KEYS = [
  { chain: "Ethereum", addr: "0x4c1f…c2a8" },
  { chain: "Base", addr: "0x91aa…10e4" },
  { chain: "Solana", addr: "7KqP…m2nR" },
  { chain: "Bitcoin", addr: "bc1q…8k2p" },
];

export function NightLanding({ signedIn }: { signedIn: boolean }) {
  const [guest, setGuest] = useState("");
  const [signed, setSigned] = useState("");
  const [cut, setCut] = useState(false);
  const [plaque, setPlaque] = useState("");

  return (
    <main className="min-h-screen pb-28" style={{ background: "radial-gradient(900px 520px at 50% 0%, #3d4a28, #12160f 60%)", color: "#e7efd4" }}>
      <header className="flex items-center justify-between px-5 py-4">
        <Link href="/" aria-label="TagAWallet home"><Logo className="text-lg" /></Link>
        <p className="text-[10px] uppercase tracking-[0.28em] text-[#d5e2a4]">Night audit</p>
      </header>
      <section className="mx-auto w-full max-w-xl px-5 pb-8 pt-4">
        <p className="text-xs uppercase tracking-[0.22em] text-[#d5e2a4]">Act I · The book</p>
        <h1 className="mt-3 text-5xl leading-[0.95] md:text-6xl" style={{ fontFamily: "Iowan Old Style, Palatino, Georgia, serif" }}>Sign them in under the lamp.</h1>
        <form className="mt-8 border border-[#d5e2a4]/30 bg-[#1a2214]/80 p-5" onSubmit={(e) => { e.preventDefault(); if (guest.trim()) setSigned(guest.trim()); }}>
          <p className="text-[10px] uppercase tracking-[0.18em] text-[#d5e2a4]">Register · room 0x4c1f…c2a8</p>
          <label htmlFor="guest" className="mt-4 block text-sm">Guest</label>
          <input id="guest" value={guest} maxLength={28} onChange={(e) => setGuest(e.target.value)} placeholder="Mina Chen" className="mt-1 w-full border-b border-[#d5e2a4]/40 bg-transparent py-2 text-2xl outline-none" style={{ fontFamily: "Iowan Old Style, Palatino, Georgia, serif" }} />
          <button type="submit" className="mt-4 bg-[#d5e2a4] px-4 py-2 text-sm font-medium text-[#17200f]">Sign the book</button>
          {signed && <p className="mt-4 text-sm">Entered. The book is the night auditor's. It is not the lobby.</p>}
        </form>
      </section>
      <section className="border-y border-[#d5e2a4]/20">
        <div className="mx-auto w-full max-w-3xl px-5 py-16">
          <p className="text-xs uppercase tracking-[0.22em] text-[#d5e2a4]">Act II · The keys</p>
          <h2 className="mt-3 text-4xl" style={{ fontFamily: "Iowan Old Style, Palatino, Georgia, serif" }}>{signed ? `${signed} may hold four keys.` : "Cut the keys when the book is signed."}</h2>
          <button type="button" disabled={!signed} onClick={() => setCut(true)} className="mt-6 border border-[#d5e2a4] px-4 py-2 text-sm disabled:opacity-40">Cut a key for every chain</button>
          <ul className="mt-6 grid gap-2 md:grid-cols-2">
            {KEYS.map((k) => (
              <li key={k.chain} className="flex items-center justify-between border border-[#d5e2a4]/25 px-3 py-3" style={{ opacity: cut ? 1 : 0.35 }}>
                <span>{k.chain}</span>
                <span className="addr text-sm">{cut ? k.addr : "—"}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <section className="mx-auto w-full max-w-3xl px-5 py-16">
        <p className="text-xs uppercase tracking-[0.22em] text-[#d5e2a4]">Act III · The lobby</p>
        <h2 className="mt-3 text-4xl" style={{ fontFamily: "Iowan Old Style, Palatino, Georgia, serif" }}>The plaque downstairs stays blank.</h2>
        <div className="mt-8 border border-[#d5e2a4]/40 bg-[#0e120c] px-6 py-10 text-center">
          <p className="text-[10px] uppercase tracking-[0.22em] text-[#d5e2a4]">Lobby</p>
          <p className="mt-4 text-3xl" style={{ fontFamily: "Iowan Old Style, Palatino, Georgia, serif" }}>{plaque || "—"}</p>
        </div>
        <button type="button" disabled={!signed} onClick={() => setPlaque("A private name does not hang here. The lobby takes a verified house.")} className="mt-4 border border-[#d5e2a4]/50 px-4 py-2 text-sm disabled:opacity-40">Hang the name in the lobby</button>
        <Link href={signedIn ? "/dashboard" : "/signup"} className="mt-8 inline-flex bg-[#d5e2a4] px-4 py-2.5 font-medium text-[#17200f]">{signedIn ? "Open dashboard" : "Sign the book. It's free."}</Link>
      </section>
    </main>
  );
}
