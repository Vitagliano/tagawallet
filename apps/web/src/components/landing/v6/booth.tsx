"use client";
import { useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/ui";

/* Projection booth. The title is the tag. The dialogue stays on the reel. */

const LEFT = "radial-gradient(circle at 50% 8px, #0a0a0a 3px, transparent 4px) 0 0 / 18px 14px repeat-y";

export function BoothLanding({ signedIn }: { signedIn: boolean }) {
  const [title, setTitle] = useState("");
  const [burned, setBurned] = useState("");
  const [frame, setFrame] = useState(0);
  const frames = [
    { k: "The take", body: "please use 0x4c1f…c2a8 for the grant, ignore the quote-tweet, she said it twice" },
    { k: "The splice", body: burned ? `${burned}` : "a blank title card, waiting" },
    { k: "The release", body: burned ? `0x4c1f…c2a8 · ${burned}` : "the print still has no name" },
  ];

  return (
    <main className="min-h-screen pb-28" style={{ background: "#070708", color: "#f4efe6" }}>
      <header className="flex items-center justify-between px-5 py-4">
        <Link href="/" aria-label="TagAWallet home"><Logo className="text-lg" /></Link>
        <p className="font-mono text-[10px] tracking-[0.28em] text-[#e7c56a]">BOOTH 3</p>
      </header>
      <section className="mx-auto w-full max-w-5xl px-5 pb-10 pt-2">
        <p className="font-mono text-[10px] tracking-[0.22em] text-[#e7c56a]">ACT I · THE REEL</p>
        <h1 className="mt-3 max-w-3xl text-5xl leading-[0.95] md:text-7xl">Splice a title into the shot.</h1>
        <div className="mt-8 flex gap-2">
          <div className="w-5 shrink-0" style={{ background: LEFT }} aria-hidden />
          <div className="min-w-0 flex-1 bg-[#111] p-2">
            <div className="grid gap-2 md:grid-cols-3">
              {frames.map((f, i) => (
                <button key={f.k} type="button" onClick={() => setFrame(i)} className={`min-h-40 p-4 text-left ${frame === i ? "bg-[#f4efe6] text-[#111]" : "bg-[#1a1a1a]"}`}>
                  <span className="font-mono text-[10px] tracking-[0.16em] opacity-60">{String(i + 1).padStart(2, "0")} {f.k}</span>
                  <span className="mt-4 block text-lg leading-snug">{f.body}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="w-5 shrink-0" style={{ background: LEFT }} aria-hidden />
        </div>
        <form className="mt-6 flex flex-wrap gap-3" onSubmit={(e) => { e.preventDefault(); if (title.trim()) { setBurned(title.trim()); setFrame(2); } }}>
          <label className="sr-only" htmlFor="title-card">Title card</label>
          <input id="title-card" value={title} maxLength={28} onChange={(e) => setTitle(e.target.value)} placeholder="Mina, invoices" className="w-64 border border-[#e7c56a]/50 bg-transparent px-3 py-2 outline-none" />
          <button type="submit" className="bg-[#e7c56a] px-4 py-2 font-medium text-[#141000]">Splice</button>
        </form>
      </section>
      <section className="bg-[#f4efe6] text-[#14120c]">
        <div className="mx-auto grid w-full max-w-5xl gap-8 px-5 py-16 md:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-[0.22em]">Act II · Intermission</p>
            <h2 className="mt-3 text-4xl" style={{ fontFamily: "Iowan Old Style, Palatino, Georgia, serif" }}>What goes upstairs.</h2>
          </div>
          <div className="grid grid-cols-2 gap-px bg-black/10">
            <div className="bg-[#f4efe6] p-4"><p className="text-xs uppercase tracking-[0.14em] text-[#6d675c]">Sent</p><p className="addr mt-3">0x4c1f…c2a8</p></div>
            <div className="bg-[#f4efe6] p-4"><p className="text-xs uppercase tracking-[0.14em] text-[#6d675c]">Stays on the reel</p><p className="mt-3 text-sm">the quote-tweet, the argument, the hour, the other tabs</p></div>
          </div>
        </div>
      </section>
      <section className="mx-auto w-full max-w-3xl px-5 py-16">
        <p className="font-mono text-[10px] tracking-[0.22em] text-[#e7c56a]">ACT III · CREDITS</p>
        <ul className="mt-6 space-y-2 text-2xl" style={{ fontFamily: "Iowan Old Style, Palatino, Georgia, serif" }}>
          {["No funds in the booth.", "No seed phrase in the gate.", "No signature to send.", "Eight chains, when they are hers.", "Chrome, Brave, Edge."].map((line) => <li key={line}>{line}</li>)}
        </ul>
        <Link href={signedIn ? "/dashboard" : "/signup"} className="mt-10 inline-flex bg-[#e7c56a] px-4 py-2.5 font-medium text-[#141000]">{signedIn ? "Open dashboard" : "Splice your own. It's free."}</Link>
      </section>
    </main>
  );
}
