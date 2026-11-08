"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BrandMark } from "@/components/brand-mark";
import { clamp } from "../shared";

/* The page is a receipt. Scrolling feeds paper up out of a printer, so it reads top to bottom as it prints. */

const INK = "#1a1a18", PAPER = "#fbf8ef", ORANGE = "#EE6A42";
const SLOT = 96; // height of the printer at the bottom of the screen

type Row = [string, string] | string | null;
const LINES: { head?: string; rows: Row[] }[] = [
  { rows: ["KNOW WHO'S BEHIND", "EVERY WALLET.", null, "Privately tag addresses, link socials, group related wallets, and recognize identities wherever you research and trade."] },
  { head: "ITEMS", rows: [["Private tags", "INCL."], ["Linked socials", "INCL."], ["Wallets under one name", "INCL."], ["Eight chains", "INCL."], ["Names on the sites you enable", "INCL."]] },
  { head: "NOT INCLUDED", rows: [["Custody of your funds", "NONE"], ["Portfolio tracking", "NONE"], ["Transaction signing", "NONE"], ["Public feed of your research", "NONE"]] },
  { head: "TODAY'S SPECIAL", rows: ["0x4c1f…2c15", "  now reads: Alice, OTC desk", "0x9e0b…77d1", "  now reads: DAO treasury", null, "Every label shows its source: yours, shared, self-claimed or verified."] },
  { head: "ACCOUNT", rows: [["Funds held", "0.00"], ["Seed phrases requested", "0"], ["Private keys requested", "0"], ["Signatures requested", "0"], null, "If someone asks you for these in our name, it isn't us. We are not a wallet, despite the name."] },
  { head: "PAGE CONTENT SENT TO US", rows: [["Total", "0 PAGES"], null, "Recognizing addresses happens in your browser."] },
];

function Printed({ name, setName, date }: { name: string; setName: (v: string) => void; date: string }) {
  return (
    <div className="font-mono text-[13px] leading-[1.75] md:text-[15px]" style={{ color: INK }}>
      <div className="grid place-items-center pb-4 text-center">
        <BrandMark size={84} />
        <p className="mt-3 text-xl font-bold tracking-tight">TAGAWALLET</p>
        <p>tagawallet.com</p>
        <p suppressHydrationWarning>{date || " "}</p>
      </div>
      {LINES.map((sec, i) => (
        <section key={i} className="border-t-2 border-dashed border-black/35 py-4">
          {sec.head && <h2 className="mb-2 font-bold">{sec.head}</h2>}
          {sec.rows.map((r, k) => r === null ? <div key={k} className="h-3" /> : Array.isArray(r)
            ? <p key={k} className="group flex justify-between gap-3 rounded-sm px-1 -mx-1 transition-colors duration-100 hover:bg-[#EE6A42]/25"><span>{r[0]}</span><span className="shrink-0 font-bold">{r[1]}</span></p>
            : <p key={k} className={i === 0 && k < 2 ? "text-2xl font-bold leading-[1.1] tracking-tight md:text-[1.9rem]" : ""}>{r}</p>)}
        </section>
      ))}
      <section className="border-t-2 border-dashed border-black/35 py-4">
        <label htmlFor="r-name" className="font-bold">CUSTOMER</label>
        <input id="r-name" value={name} maxLength={24} onChange={(e) => setName(e.target.value)} placeholder="write your name" autoComplete="off"
          className="mt-1 block w-full border-b border-black/50 bg-transparent py-1 uppercase outline-none placeholder:normal-case placeholder:text-black/40" style={{ outline: "none" }} />
        <p className="mt-2 text-xs text-black/60">Stays on this page. Nothing is sent or saved.</p>
      </section>
      <section className="border-t-2 border-black py-4">
        <p className="flex justify-between text-2xl font-bold"><span>TOTAL</span><span>$0.00</span></p>
        <p>Start tagging, it&apos;s free.</p>
        <p className="mt-3 text-center">{name.trim() ? `THANK YOU, ${name.trim().toUpperCase()}.` : "THANK YOU."}</p>
        <div aria-hidden className="mt-3 h-14" style={{ backgroundImage: `repeating-linear-gradient(90deg, ${INK} 0 2px, transparent 2px 5px, ${INK} 5px 6px, transparent 6px 8px, ${INK} 8px 12px, transparent 12px 14px)` }} />
      </section>
      <p className="border-t-2 border-dashed border-black/60 pt-2 text-center text-xs">✂ tear here</p>
    </div>
  );
}

export function ReceiptLanding({ signedIn }: { signedIn: boolean }) {
  const root = useRef<HTMLElement>(null);
  const paper = useRef<HTMLDivElement>(null);
  const shell = useRef<HTMLDivElement>(null);
  const [h, setH] = useState(1800);
  const [done, setDone] = useState(false);
  const [torn, setTorn] = useState(false);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const tornRef = useRef(false); tornRef.current = torn;
  const pullY = useRef<{ start: number; y: number } | null>(null);

  useEffect(() => {
    const d = new Date();
    setDate(d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" }) + "  " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }));
    const ro = new ResizeObserver(([e]) => setH(e.contentRect.height));
    ro.observe(paper.current!);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let raf = 0, last = performance.now(), fed = 240;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const r = root.current!.getBoundingClientRect();
      const p = clamp(-r.top / Math.max(1, r.height - innerHeight));
      // A little paper on arrival, so it's obvious what this thing is.
      const target = 300 + p * (paper.current!.offsetHeight - 300 + 10);
      const prev = fed;
      fed = reduce ? target : fed + (target - fed) * (1 - Math.exp(-dt * 11));
      const speed = Math.abs(fed - prev) / Math.max(dt, 0.001);
      const y = innerHeight - SLOT - fed + (pullY.current?.y ?? 0);
      // Thermal printers judder while they feed.
      const jitter = reduce || tornRef.current ? 0 : Math.min(1.3, speed * 0.0016) * Math.sin(now * 0.09);
      if (!tornRef.current) {
        paper.current!.style.transform = `translate(${jitter}px, ${y}px)`;
        if (shell.current) shell.current.style.transform = `translateY(${jitter * 0.5}px)`;
      }
      setDone(p > 0.985);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const paper_h = () => paper.current!.offsetHeight;
  const tear = () => {
    if (tornRef.current) return;
    tornRef.current = true;
    setTorn(true);
    const el = paper.current!, from = new DOMMatrix(getComputedStyle(el).transform).m42;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { el.style.visibility = "hidden"; return; }
    el.animate([{ transform: `translateY(${from}px) rotate(0deg)` }, { transform: `translateY(${from - paper_h() - innerHeight}px) rotate(-6deg)` }], { duration: 950, easing: "cubic-bezier(.5,0,.8,.4)", fill: "forwards" });
  };

  return (
    <div style={{ background: INK }}>
      <main ref={root} style={{ height: `calc(${h}px + 100dvh)` }}>
        <div className="sticky top-0 h-dvh overflow-hidden">
          {/* Stage behind the paper: revealed once the receipt is torn off. */}
          <section className={`absolute inset-0 grid place-items-center px-6 pb-24 text-center text-[#f6f4ee] transition-opacity duration-700 ${torn ? "opacity-100" : "pointer-events-none opacity-0"}`} aria-hidden={!torn}>
            <div>
              <p className="text-[clamp(2.75rem,8vw,7rem)] font-semibold leading-[.98] tracking-[-0.035em]">{name.trim() ? <>Keep it, {name.trim()}.</> : "Keep the receipt."}</p>
              <p className="mx-auto mt-4 max-w-md text-lg text-[#b5b1a5]">Put a name on your first wallet. It takes a few seconds.</p>
              <Link tabIndex={torn ? 0 : -1} href={signedIn ? "/dashboard" : "/signup"} className="mt-7 inline-flex items-center gap-2 rounded-full px-7 py-4 text-lg font-medium text-[#1a0d07] transition-transform duration-200 hover:scale-[1.04] active:scale-95" style={{ background: ORANGE }}>{signedIn ? "Open dashboard" : "Start tagging"}<span className="cta-arrow" aria-hidden>→</span></Link>
              <p className="mt-10 flex justify-center gap-5 text-sm text-[#9c988b]"><span>© {new Date().getFullYear()} TagAWallet</span><Link tabIndex={torn ? 0 : -1} href="/privacy" className="hover:underline">Privacy</Link><Link tabIndex={torn ? 0 : -1} href="/terms" className="hover:underline">Terms</Link></p>
            </div>
          </section>

          {/* Paper rises from the slot, so only what's been printed is visible. */}
          <div className="absolute inset-x-0 top-0 overflow-hidden" style={{ bottom: SLOT }}>
            <div ref={paper} className="absolute left-1/2 top-0 w-[min(90vw,430px)] px-5 pb-6 pt-7 shadow-[0_30px_60px_rgba(0,0,0,.5)] md:px-7"
              onPointerDown={(e) => {
                if (!done || e.pointerType !== "mouse" || (e.target as HTMLElement).closest("input,a,button")) return;
                e.currentTarget.setPointerCapture(e.pointerId);
                pullY.current = { start: e.clientY, y: 0 };
              }}
              onPointerMove={(e) => { if (pullY.current) pullY.current.y = clamp(e.clientY - pullY.current.start, -160, 0); }}
              onPointerUp={() => { const y = pullY.current?.y ?? 0; pullY.current = null; if (y < -90) tear(); }}
              style={{ marginLeft: "calc(min(90vw, 430px) / -2)", background: PAPER, clipPath: "polygon(0 0, 2% 6px, 4% 0, 6% 6px, 8% 0, 10% 6px, 12% 0, 14% 6px, 16% 0, 18% 6px, 20% 0, 22% 6px, 24% 0, 26% 6px, 28% 0, 30% 6px, 32% 0, 34% 6px, 36% 0, 38% 6px, 40% 0, 42% 6px, 44% 0, 46% 6px, 48% 0, 50% 6px, 52% 0, 54% 6px, 56% 0, 58% 6px, 60% 0, 62% 6px, 64% 0, 66% 6px, 68% 0, 70% 6px, 72% 0, 74% 6px, 76% 0, 78% 6px, 80% 0, 82% 6px, 84% 0, 86% 6px, 88% 0, 90% 6px, 92% 0, 94% 6px, 96% 0, 98% 6px, 100% 0, 100% 100%, 0 100%)", transform: "translateY(100vh)" }}>
              <Printed name={name} setName={setName} date={date} />
            </div>
            {/* Shadow cast by the printer onto the paper. */}
            <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-9" style={{ background: "linear-gradient(transparent, rgba(0,0,0,.45))" }} />
          </div>

          {/* The printer */}
          <div ref={shell} className="absolute inset-x-0 bottom-0 z-10 flex justify-center">
            <div className="relative flex w-[min(100vw,600px)] items-center justify-between rounded-t-2xl border-x border-t border-white/10 px-5 pb-3 pt-6 text-[#f6f4ee] md:px-6" style={{ height: SLOT, background: "#2a2a27" }}>
              <Link href="/" aria-label="TagAWallet home" className="flex items-center gap-2 font-semibold"><BrandMark size={30} />TagAWallet</Link>
              <span className="flex items-center gap-3 text-sm"><Link href="/login" className="hover:underline">Sign in</Link><Link href={signedIn ? "/dashboard" : "/signup"} className="rounded-full px-3.5 py-1.5 font-medium text-[#1a0d07]" style={{ background: ORANGE }}>{signedIn ? "Dashboard" : "Get started"}</Link></span>
              <span aria-hidden className="absolute inset-x-[calc(50%-min(47vw,227px))] top-3 h-1.5 rounded-full bg-black" />
            </div>
          </div>

          {!torn && (
            <button type="button" onClick={tear} disabled={!done} aria-hidden={!done} tabIndex={done ? 0 : -1}
              className={`absolute left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full px-6 py-3 font-medium text-[#1a0d07] shadow-xl transition-all duration-300 hover:scale-105 ${done ? "opacity-100" : "pointer-events-none translate-y-4 opacity-0"}`} style={{ background: ORANGE, bottom: SLOT + 14 }}>✂ Tear it off</button>
          )}
          {!done && !torn && <p className="pointer-events-none absolute right-5 top-5 hidden font-mono text-sm text-[#9c988b] md:block">Scroll to print ↓</p>}
        </div>
      </main>
    </div>
  );
}
