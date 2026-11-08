"use client";
import { useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/ui";

/* A field station. The slate is the tag. A false front keeps the needle hunting. */

const SITES = ["Etherscan", "X", "The desk"];

export function StationLanding({ signedIn }: { signedIn: boolean }) {
  const [chalk, setChalk] = useState("");
  const [slate, setSlate] = useState("");
  const [hunt, setHunt] = useState(false);
  const [falseFront, setFalseFront] = useState("");

  function write() {
    const v = chalk.trim();
    if (!v) return;
    setSlate(v);
    setHunt(false);
    setFalseFront("");
  }

  function spoof() {
    setHunt(true);
    window.setTimeout(() => {
      setHunt(false);
      setFalseFront("0x4c1f…c2a9 is a false front. The slate keeps the name you chalked.");
    }, 900);
  }

  const deg = slate ? -28 : 36;

  return (
    <main className="min-h-screen pb-28" style={{ background: "#e7f0e4", color: "#14211a" }}>
      <header className="flex items-center justify-between px-5 py-4">
        <Link href="/" aria-label="TagAWallet home"><Logo className="text-lg" /></Link>
        <p className="text-[10px] uppercase tracking-[0.28em]">Station 4 · night watch</p>
      </header>
      <section className="mx-auto grid w-full max-w-5xl items-center gap-10 px-5 pb-12 pt-4 md:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-[#2f6b45]">Act I · The slate</p>
          <h1 className="mt-3 text-5xl leading-[0.95] md:text-6xl" style={{ fontFamily: "Iowan Old Style, Palatino, Georgia, serif" }}>Chalk the name the instruments are measuring.</h1>
          <form className="mt-6" onSubmit={(e) => { e.preventDefault(); write(); }}>
            <label htmlFor="chalk" className="text-xs uppercase tracking-[0.16em]">Chalk</label>
            <input id="chalk" value={chalk} maxLength={28} onChange={(e) => setChalk(e.target.value)} placeholder="Mina" className="mt-2 block w-full max-w-sm border-b border-[#14211a]/30 bg-transparent py-2 text-2xl outline-none" />
            <button type="submit" className="mt-4 bg-[#14211a] px-4 py-2 text-sm text-[#e7f0e4]">Write the slate</button>
          </form>
        </div>
        <div className="grid place-items-center">
          <div className="relative grid h-56 w-56 place-items-center rounded-full border-[10px] border-[#14211a] bg-[#f7fbf6] shadow-inner">
            <span className={`absolute left-1/2 top-1/2 h-1 w-20 origin-left bg-[#14211a] ${hunt ? "needle-hunt" : ""}`} style={hunt ? undefined : { transform: `rotate(${deg}deg)` }} />
            <span className="absolute bottom-8 text-center text-sm">{slate || "unnamed"}</span>
          </div>
          <p className="addr mt-4 text-sm">reading 0x4c1f…c2a8</p>
        </div>
      </section>
      <section className="bg-[#163024] text-[#e7f6ea]">
        <div className="mx-auto w-full max-w-5xl px-5 py-16">
          <p className="text-xs uppercase tracking-[0.22em] text-[#9dcea8]">Act II · The synoptic</p>
          <h2 className="mt-3 text-4xl" style={{ fontFamily: "Iowan Old Style, Palatino, Georgia, serif" }}>Three sites, one reading.</h2>
          <div className="mt-8 grid gap-3 md:grid-cols-3">
            {SITES.map((s) => (
              <article key={s} className="border border-[#9dcea8]/30 p-4">
                <p className="text-[10px] uppercase tracking-[0.16em] text-[#9dcea8]">{s}</p>
                <p className="mt-6 text-2xl" style={{ fontFamily: "Iowan Old Style, Palatino, Georgia, serif" }}>{slate || "—"}</p>
                <p className="addr mt-2 text-xs text-[#9dcea8]">0x4c1f…c2a8</p>
              </article>
            ))}
          </div>
          <p className="mt-6 max-w-lg text-sm text-[#9dcea8]">The hut keeps the log. Lookup carries the reading. The weather around it, the thread, the page, stays here.</p>
        </div>
      </section>
      <section className="mx-auto w-full max-w-5xl px-5 py-16">
        <p className="text-xs uppercase tracking-[0.22em] text-[#9c2b1a]">Act III · False front</p>
        <h2 className="mt-3 max-w-2xl text-4xl" style={{ fontFamily: "Iowan Old Style, Palatino, Georgia, serif" }}>A digit shifts and the needle will not settle.</h2>
        <button type="button" onClick={spoof} className="mt-6 border border-[#9c2b1a] px-4 py-2 text-sm">Report 0x4c1f…c2a9 as the same reading</button>
        <p className="mt-4 min-h-6 text-sm text-[#9c2b1a]" role="status">{hunt ? "Needle hunting." : falseFront}</p>
        <Link href={signedIn ? "/dashboard" : "/signup"} className="mt-8 inline-flex bg-[#14211a] px-4 py-2.5 text-[#e7f0e4]">{signedIn ? "Open dashboard" : "Chalk a wallet. It's free."}</Link>
      </section>
    </main>
  );
}
