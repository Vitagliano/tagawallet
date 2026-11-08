"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/ui";
import { reducedMotion } from "../shared";

/* Safelight. The address is latent until you hold it in the bath. */

const FOG = [
  { addr: "0x91aa…10e4", cap: "" },
  { addr: "bc1q…8k2p", cap: "" },
];

export function FixerLanding({ signedIn }: { signedIn: boolean }) {
  const [bath, setBath] = useState(0);
  const [cap, setCap] = useState("");
  const [burned, setBurned] = useState("");
  const [drawer, setDrawer] = useState<"private" | "desk" | null>(null);
  const [refused, setRefused] = useState(false);
  const hold = useRef(false);

  useEffect(() => {
    if (reducedMotion()) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (hold.current) setBath((b) => Math.min(1, b + dt * 0.62));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const ready = bath >= 1;
  const paper = `rgb(${40 + bath * 200}, ${12 + bath * 200}, ${16 + bath * 180})`;
  const ink = `rgba(20,6,8,${0.15 + bath * 0.85})`;

  function burn() {
    const v = cap.trim();
    if (!v) return;
    setBurned(v);
  }

  return (
    <main className="min-h-screen pb-28" style={{ background: "radial-gradient(1200px 700px at 50% -10%, #6a1020, #1a0406 55%)", color: "#ffd2cc" }}>
      <header className="flex items-center justify-between px-5 py-4">
        <Link href="/" aria-label="TagAWallet home"><Logo className="text-lg" /></Link>
        <p className="text-[10px] uppercase tracking-[0.28em] text-[#ff8d86]">Safelight on</p>
      </header>

      <section className="mx-auto w-full max-w-5xl px-5 pb-16 pt-4 md:pt-10">
        <p className="text-xs uppercase tracking-[0.22em]">Act I · The bath</p>
        <h1 className="mt-3 max-w-3xl text-5xl leading-[0.92] md:text-7xl" style={{ fontFamily: "Iowan Old Style, Palatino, Georgia, serif" }}>Hold the sheet until someone appears.</h1>
        <div className="mt-8 grid items-start gap-8 md:grid-cols-[280px_1fr]">
          <button
            type="button"
            onPointerDown={() => { hold.current = true; }}
            onPointerUp={() => { hold.current = false; }}
            onPointerLeave={() => { hold.current = false; }}
            onClick={() => setBath(1)}
            className="relative aspect-[4/5] w-full max-w-xs text-left shadow-2xl"
            style={{ background: paper }}
            aria-label={ready ? "Sheet developed" : "Hold to develop, or press to develop at once"}
          >
            <span className="absolute inset-6 flex flex-col justify-end" style={{ color: ink, opacity: 0.2 + bath * 0.8 }}>
              <span className="addr text-sm">0x4c1f…c2a8</span>
              <span className="mt-3 text-2xl" style={{ fontFamily: "Iowan Old Style, Palatino, Georgia, serif" }}>{burned || " "}</span>
            </span>
            {!ready && <span className="absolute bottom-3 left-3 text-[10px] uppercase tracking-[0.16em]" style={{ color: ink }}>Hold</span>}
          </button>
          <div>
            <p className="max-w-md text-[#ffb2aa]">The address is latent in the paper. The room stays red. Only the print comes up sharp, and only after you keep your hand on it.</p>
            <p className="addr mt-4 text-sm text-[#ff8d86]">{Math.round(bath * 100)}% developed</p>
            {ready && (
              <form onSubmit={(e) => { e.preventDefault(); burn(); }} className="mt-6">
                <label htmlFor="cap" className="text-xs uppercase tracking-[0.16em]">Caption, in pencil</label>
                <input id="cap" value={cap} maxLength={32} onChange={(e) => setCap(e.target.value)} placeholder="Mina, invoices" className="mt-2 w-full max-w-sm border-b border-[#ffd2cc]/40 bg-transparent py-2 outline-none placeholder:text-[#ffd2cc]/30" />
                <button type="submit" className="mt-4 bg-[#ffd2cc] px-4 py-2 text-sm font-medium text-[#2a0c0c]">Burn in the caption</button>
              </form>
            )}
          </div>
        </div>
      </section>

      <section style={{ background: "#070203", color: "#f4e7df" }}>
        <div className="mx-auto w-full max-w-5xl px-5 py-16 md:py-24">
          <p className="text-xs uppercase tracking-[0.22em] text-[#ff8d86]">Act II · The line</p>
          <h2 className="mt-3 max-w-xl text-4xl md:text-5xl" style={{ fontFamily: "Iowan Old Style, Palatino, Georgia, serif" }}>Uncaptioned prints stay fog.</h2>
          <div className="mt-8 flex gap-4 overflow-x-auto pb-2">
            {[{ addr: "0x4c1f…c2a8", cap: burned }, ...FOG].map((p) => (
              <figure key={p.addr} className="w-44 shrink-0">
                <div className="flex aspect-[4/5] items-end p-3" style={{ background: p.cap ? "#f3e0d4" : "#3a221e", filter: p.cap ? "none" : "blur(1.5px)", color: "#2a0c0c" }}>
                  <span>
                    <span className="addr block text-[11px]">{p.addr}</span>
                    <span className="mt-2 block text-lg" style={{ fontFamily: "Iowan Old Style, Palatino, Georgia, serif" }}>{p.cap || " "}</span>
                  </span>
                </div>
                <figcaption className="mt-2 text-xs text-[#a88880]">{p.cap ? "Fixed" : "Still latent"}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-5 py-16 md:py-24">
        <p className="text-xs uppercase tracking-[0.22em]">Act III · Where it files</p>
        <h2 className="mt-3 max-w-2xl text-4xl md:text-5xl" style={{ fontFamily: "Iowan Old Style, Palatino, Georgia, serif" }}>A private print does not hang in the gallery.</h2>
        <div className="mt-8 grid gap-3 md:grid-cols-3">
          <button type="button" disabled={!burned} onClick={() => { setDrawer("private"); setRefused(false); }} className="border border-[#ffd2cc]/30 p-4 text-left disabled:opacity-40">
            <span className="block text-lg">Locked drawer</span>
            <span className="mt-2 block text-sm text-[#ffb2aa]">{drawer === "private" ? `Filed. ${burned}. Only you.` : "Your list. Private."}</span>
          </button>
          <button type="button" disabled={!burned} onClick={() => { setDrawer("desk"); setRefused(false); }} className="border border-[#ffd2cc]/30 p-4 text-left disabled:opacity-40">
            <span className="block text-lg">The desk</span>
            <span className="mt-2 block text-sm text-[#ffb2aa]">{drawer === "desk" ? "Passed to the people you invite." : "A shared list. An invitation."}</span>
          </button>
          <button type="button" disabled={!burned} onClick={() => { setRefused(true); setDrawer(null); }} className="border border-[#ffd2cc]/30 p-4 text-left disabled:opacity-40">
            <span className="block text-lg">Gallery wall</span>
            <span className="mt-2 block text-sm text-[#ffb2aa]">{refused ? "Refused. The wall takes a verified print." : "Public. Needs a check."}</span>
          </button>
        </div>
        <Link href={signedIn ? "/dashboard" : "/signup"} className="mt-10 inline-flex bg-[#ffd2cc] px-4 py-2.5 font-medium text-[#2a0c0c]">{signedIn ? "Open dashboard" : "Open a drawer. It's free."}</Link>
      </section>
    </main>
  );
}
