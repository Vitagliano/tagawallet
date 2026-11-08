"use client";
import { useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/ui";

/* The street sees cloth. You see the lining. A twin coat was never sewn. */

function Coat({ open, stitch, twin }: { open: boolean; stitch: string; twin?: boolean }) {
  return (
    <div className="relative mx-auto h-72 w-48">
      <div className="absolute inset-x-6 top-0 h-10 rounded-t-full" style={{ background: open ? "#e7d3b0" : "#2c2926" }} />
      <div className="absolute inset-x-0 top-8 bottom-0 rounded-b-[28px] rounded-t-[36px] shadow-xl" style={{ background: open ? "#e7d3b0" : "#2c2926" }}>
        <div className="absolute inset-y-6 left-1/2 w-px -translate-x-1/2" style={{ background: open ? "#c9a27a" : "#1a1816" }} />
        {open && (
          <p className="absolute inset-x-4 bottom-8 text-center text-xl text-[#5c3b22]" style={{ fontFamily: "Iowan Old Style, Palatino, Georgia, serif" }}>
            {twin ? "unsewn" : stitch || "bare lining"}
          </p>
        )}
        {!open && <p className="absolute inset-x-3 bottom-8 text-center text-xs uppercase tracking-[0.16em] text-[#d9d3cc]">cloth</p>}
      </div>
    </div>
  );
}

export function LiningLanding({ signedIn }: { signedIn: boolean }) {
  const [stitch, setStitch] = useState("");
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const [twinOpen, setTwinOpen] = useState(false);

  return (
    <main className="min-h-screen pb-28" style={{ background: "#f4f0ea", color: "#221e1a" }}>
      <header className="flex items-center justify-between px-5 py-4">
        <Link href="/" aria-label="TagAWallet home"><Logo className="text-lg" /></Link>
        <p className="text-[10px] uppercase tracking-[0.28em]">Atelier</p>
      </header>
      <section className="mx-auto grid w-full max-w-5xl items-center gap-8 px-5 pb-12 pt-2 md:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-[#8a5a00]">Act I · The stitch</p>
          <h1 className="mt-3 text-5xl leading-[0.95] md:text-6xl" style={{ fontFamily: "Iowan Old Style, Palatino, Georgia, serif" }}>Sew the name where the street cannot see it.</h1>
          <form className="mt-6" onSubmit={(e) => { e.preventDefault(); if (draft.trim()) { setStitch(draft.trim()); setOpen(true); } }}>
            <label htmlFor="stitch" className="text-xs uppercase tracking-[0.16em]">Thread</label>
            <input id="stitch" value={draft} maxLength={24} onChange={(e) => setDraft(e.target.value)} placeholder="Mina" className="mt-2 block w-full max-w-xs border-b border-black/30 bg-transparent py-2 text-2xl outline-none" />
            <button type="submit" className="mt-4 bg-[#221e1a] px-4 py-2 text-sm text-[#f4f0ea]">Sew the lining</button>
          </form>
        </div>
        <Coat open={open} stitch={stitch} />
      </section>
      <section className="bg-[#221e1a] text-[#f4f0ea]">
        <div className="mx-auto w-full max-w-5xl px-5 py-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-[#e7c56a]">Act II · The street</p>
              <h2 className="mt-3 max-w-xl text-4xl" style={{ fontFamily: "Iowan Old Style, Palatino, Georgia, serif" }}>Buttoned, it is only a coat.</h2>
            </div>
            <button type="button" onClick={() => setOpen((v) => !v)} className="border border-[#e7c56a] px-4 py-2 text-sm" aria-pressed={open}>{open ? "Button it" : "Turn the lining"}</button>
          </div>
          <div className="mt-10 grid gap-6 rounded-3xl bg-[#f4f0ea] px-4 py-8 text-[#221e1a] md:grid-cols-3">
            {["Etherscan", "X", "The desk"].map((s) => (
              <figure key={s}>
                <Coat open={open} stitch={stitch} />
                <figcaption className="mt-3 text-center text-xs uppercase tracking-[0.16em]">{s}</figcaption>
              </figure>
            ))}
          </div>
          <p className="mt-8 max-w-lg text-sm text-[#d9d3cc]">The extension is the turn of the coat. Everyone else keeps seeing cloth. Your list is the lining.</p>
        </div>
      </section>
      <section className="mx-auto grid w-full max-w-5xl items-center gap-8 px-5 py-16 md:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-[#9c2b1a]">Act III · The twin</p>
          <h2 className="mt-3 text-4xl" style={{ fontFamily: "Iowan Old Style, Palatino, Georgia, serif" }}>Same cloth. Nothing sewn.</h2>
          <p className="mt-4 max-w-md">0x4c1f…c2a9 hangs beside hers. Turn it. The lining was never stitched, and the thread from the first coat does not transfer.</p>
          <button type="button" onClick={() => setTwinOpen((v) => !v)} className="mt-4 border border-[#221e1a] px-4 py-2 text-sm" aria-pressed={twinOpen}>{twinOpen ? "Button the twin" : "Turn the twin"}</button>
          <Link href={signedIn ? "/dashboard" : "/signup"} className="mt-8 inline-flex bg-[#221e1a] px-4 py-2.5 text-[#f4f0ea]">{signedIn ? "Open dashboard" : "Sew a lining. It's free."}</Link>
        </div>
        <Coat open={twinOpen} stitch="" twin />
      </section>
    </main>
  );
}
