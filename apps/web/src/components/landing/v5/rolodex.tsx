"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BrandMark } from "@/components/brand-mark";
import { Logo } from "@/components/ui";
import { clamp } from "../shared";

/* One object on a desk. Scrolling turns the wheel, and the page is what's filed inside. */

const ORANGE = "#EE6A42", INK = "#1a1a18", CARD = "#fbf8f0", RULE = "#d9d3c2", SOFT = "#6a675e";
const STEP = 19; // degrees between cards on the wheel

type Entry = { tab: string; kind: "cover" | "entity" | "point" | "blank"; title: string; rows?: [string, string][]; body?: string; meta?: string };
const CARDS: Entry[] = [
  { tab: "★", kind: "cover", title: "Know who's behind every wallet." },
  { tab: "A", kind: "entity", title: "Alice, OTC desk", meta: "Your private tag", rows: [["0x4c1f…2c15", "Ethereum"], ["0x8Ba1…BA72", "Base"], ["7xKX…gAsU", "Solana"], ["@alice_otc", "X"]], body: "Settles fast. Met at a conference." },
  { tab: "D", kind: "entity", title: "DAO treasury", meta: "Shared by Research", rows: [["0x9e0b…77d1", "Ethereum"], ["0xb0A8…F5D2", "Arbitrum"]], body: "Your team sees this card too. Nobody else does." },
  { tab: "E", kind: "entity", title: "Exchange hot wallet", meta: "Verified", rows: [["0xb71a…40ce", "Ethereum"], ["0x60AE…b4A6", "BNB Chain"], ["bc1q…f3k9", "Bitcoin"]], body: "A verified public profile, marked so a claim never looks like a fact." },
  { tab: "P", kind: "point", title: "Private by default", body: "Lists, notes and labels are yours alone until you invite someone. There is no public feed of what you're researching." },
  { tab: "S", kind: "point", title: "Every card shows its source", body: "Your private tag, a shared list, a self-claim or a verified profile. You always know who is saying what." },
  { tab: "W", kind: "point", title: "It comes with you", body: "Names appear next to addresses on explorers, X and trading tools you enable. Page content never leaves your browser." },
  { tab: "N", kind: "point", title: "Not a wallet", body: "Despite the name. It holds no funds and will never ask for your seed phrase, private key or a transaction signature." },
  { tab: "+", kind: "blank", title: "" },
];
const LAST = CARDS.length - 1;

function CardFace({ c, signedIn, onName, name }: { c: Entry; signedIn: boolean; onName: (v: string) => void; name: string }) {
  const href = signedIn ? "/dashboard" : "/signup";
  if (c.kind === "cover") return (
    <div className="flex h-full flex-col">
      <h1 className="text-[clamp(2.1rem,5.4vmin,3.9rem)] font-semibold leading-[1] tracking-[-0.03em]">Know who&apos;s behind every wallet.</h1>
      <p className="mt-3 max-w-md text-[clamp(.85rem,1.9vmin,1.1rem)]" style={{ color: SOFT }}>The address book crypto never gave you. Private tags, linked socials, and related wallets filed under one name.</p>
      <div className="mt-auto flex justify-end pb-2"><BrandMark className="w-[clamp(4rem,14vmin,8.5rem)]" /></div>
      <p className="flex items-center justify-between gap-3 text-sm font-medium"><span className="hidden sm:inline">Scroll to turn the wheel</span><span className="sm:hidden">Scroll</span><Link href={href} className="rounded-full px-4 py-2 text-white" style={{ background: INK }}>{signedIn ? "Open dashboard" : "Get started"}</Link></p>
    </div>
  );
  if (c.kind === "entity") return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3"><h2 className="text-[clamp(1.6rem,4.2vmin,3rem)] font-semibold leading-none tracking-[-0.03em]">{c.title}</h2><span className="text-sm font-medium" style={{ color: "#c8421b" }}>{c.meta}</span></div>
      <ul className="mt-[2vmin]">{c.rows!.map(([a, b]) => <li key={a} className="flex justify-between gap-3 border-b py-[.8vmin] text-[clamp(.8rem,1.8vmin,1rem)]" style={{ borderColor: RULE }}><span className="truncate font-mono">{a}</span><span style={{ color: SOFT }}>{b}</span></li>)}</ul>
      <p className="mt-auto pt-2 text-[clamp(.85rem,1.9vmin,1.05rem)]" style={{ color: SOFT }}>{c.body}</p>
    </div>
  );
  if (c.kind === "point") return (
    <div className="flex h-full flex-col justify-center">
      <h2 className="text-[clamp(2rem,5.2vmin,3.75rem)] font-semibold leading-[1] tracking-[-0.03em]">{c.title}</h2>
      <p className="mt-3 max-w-lg text-[clamp(.95rem,2.1vmin,1.25rem)]" style={{ color: SOFT }}>{c.body}</p>
    </div>
  );
  return (
    <div className="flex h-full flex-col">
      <label htmlFor="rolo-name" className="text-sm font-medium" style={{ color: "#c8421b" }}>This one&apos;s blank. Who&apos;s your first card?</label>
      <input id="rolo-name" value={name} maxLength={28} onChange={(e) => onName(e.target.value)} placeholder="Write a name" autoComplete="off"
        className="mt-1 w-full border-b-2 bg-transparent text-[clamp(1.75rem,4.8vmin,3.25rem)] font-semibold tracking-[-0.03em] outline-none" style={{ borderColor: INK, outline: "none" }} />
      <p className="mt-2 text-sm" style={{ color: SOFT }}>Nothing is saved or sent until you make an account.</p>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
        <Link href={href} className="inline-flex items-center gap-2 rounded-full px-5 py-3 font-medium text-white" style={{ background: INK }}>{signedIn ? "Open dashboard" : name.trim() ? `File ${name.trim()}` : "Start tagging, it's free"}<span className="cta-arrow" aria-hidden>→</span></Link>
        <span className="flex gap-3 text-xs" style={{ color: SOFT }}><Link href="/privacy" className="hover:underline">Privacy</Link><Link href="/terms" className="hover:underline">Terms</Link></span>
      </div>
    </div>
  );
}

export function RolodexLanding({ signedIn }: { signedIn: boolean }) {
  const root = useRef<HTMLElement>(null);
  const cards = useRef<(HTMLDivElement | null)[]>([]);
  const knobs = useRef<(HTMLDivElement | null)[]>([]);
  const [current, setCurrent] = useState(0);
  const [name, setName] = useState("");

  useEffect(() => {
    let raf = 0, last = performance.now();
    const pos = { v: 0, vel: 0 };
    const raw = () => { const r = root.current!.getBoundingClientRect(); return clamp(-r.top / Math.max(1, r.height - innerHeight)) * LAST; };
    pos.v = raw();
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const paint = () => {
      const R = Math.min(innerHeight, innerWidth * 1.15) * 0.92;
      cards.current.forEach((el, i) => {
        if (!el) return;
        const a = (pos.v - i) * STEP; // past cards fall forward, future ones wait behind
        const show = a > -62 && a < 15;
        el.style.visibility = show ? "visible" : "hidden";
        if (!show) return;
        el.style.transform = `translateZ(${-R}px) rotateX(${-a}deg) translateZ(${R}px)`;
        // Shade cards as they tilt away from the light.
        const dim = el.firstElementChild as HTMLElement;
        dim.style.filter = `brightness(${1 - Math.min(0.32, Math.abs(a) * 0.006)})`;
        // A turned card tips toward you and clears out of the way.
        el.style.opacity = String(1 - Math.max(0, Math.min(1, (a - 3) / 11)));
        el.style.zIndex = String(200 - Math.round(Math.abs(a)));
        el.style.pointerEvents = Math.abs(a) < STEP / 2 ? "auto" : "none";
      });
      knobs.current.forEach((k) => { if (k) k.style.transform = `rotate(${pos.v * STEP * 2}deg)`; });
      setCurrent((c) => { const n = Math.round(pos.v); return c === n ? c : n; });
    };
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      // Detents: the wheel prefers to rest on a card, then springs into place like a real one.
      const r = raw(), near = Math.round(r), pull = near + (r - near) * 0.35;
      pos.vel += ((pull - pos.v) * 120 - pos.vel * 15) * dt;
      pos.v += pos.vel * dt;
      paint();
      raf = requestAnimationFrame(tick);
    };
    if (reduce) {
      const on = () => { pos.v = Math.round(raw()); paint(); };
      on();
      addEventListener("scroll", on, { passive: true });
      return () => removeEventListener("scroll", on);
    }
    paint();
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const goTo = (i: number) => {
    const r = root.current!, top = r.offsetTop + (i / LAST) * (r.offsetHeight - innerHeight);
    scrollTo({ top, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };

  return (
    <div style={{ background: ORANGE, color: INK }}>
      <header className="pointer-events-none fixed inset-x-0 top-0 z-[300] flex items-center justify-between p-4 md:p-5">
        <Link href="/" aria-label="TagAWallet home" className="pointer-events-auto text-[#1a1a18] [&_path[fill='#EE6A42']]:fill-white"><Logo className="text-lg" /></Link>
        <nav className="pointer-events-auto flex items-center gap-4 text-sm font-medium"><Link href="/login" className="hover:underline">Sign in</Link><Link href={signedIn ? "/dashboard" : "/signup"} className="rounded-full bg-[#1a1a18] px-4 py-2 text-white">{signedIn ? "Dashboard" : "Get started"}</Link></nav>
      </header>
      <main ref={root} className="relative" style={{ height: `${CARDS.length * 95 + 100}vh` }}>
        <div className="sticky top-0 grid h-dvh place-items-center overflow-hidden">
          {/* The machine */}
          <div className="relative h-[min(62vmin,540px)] w-[min(90vw,104vmin,860px)]" style={{ perspective: "1500px", perspectiveOrigin: "50% 40%" }}>
            <div className="absolute inset-0" style={{ transformStyle: "preserve-3d" }}>
              {CARDS.map((c, i) => (
                <div key={c.tab} ref={(el) => { cards.current[i] = el; }} className="absolute inset-0" style={{ transformOrigin: "50% 100%", backfaceVisibility: "hidden" }} aria-hidden={current !== i}>
                  <div className="relative h-full rounded-xl p-[3vmin] pt-[4vmin] shadow-[0_2px_0_rgba(0,0,0,.08)] md:p-8 md:pt-9" style={{ background: CARD, color: INK, border: `1px solid ${RULE}`, backgroundImage: `repeating-linear-gradient(transparent 0 calc(3.2vmin - 1px), ${RULE}55 calc(3.2vmin - 1px) 3.2vmin)` }}>
                    {/* The slot that holds a card on the rod. */}
                    <span aria-hidden className="absolute -bottom-px left-1/2 h-3 w-20 -translate-x-1/2 rounded-t-full" style={{ background: ORANGE }} />
                    <button type="button" tabIndex={-1} onClick={() => goTo(i)} aria-hidden className="absolute -top-6 grid h-6 w-9 place-items-center rounded-t-md font-mono text-xs font-semibold" style={{ left: `${6 + (i * 88) / CARDS.length}%`, background: i === current ? INK : CARD, color: i === current ? "#fff" : INK, border: `1px solid ${RULE}`, borderBottom: 0 }}>{c.tab}</button>
                    <CardFace c={c} signedIn={signedIn} name={name} onName={setName} />
                  </div>
                </div>
              ))}
            </div>
            {/* Rod and knobs sit in front of the wheel. */}
            <div aria-hidden className="pointer-events-none absolute -inset-x-[7vmin] bottom-[-2.2vmin] z-[250] h-[2.6vmin] rounded-full" style={{ background: INK }} />
            {[0, 1].map((k) => (
              <div key={k} ref={(el) => { knobs.current[k] = el; }} aria-hidden className={`pointer-events-none absolute bottom-[-4.8vmin] z-[260] grid size-[8vmin] place-items-center rounded-full ${k ? "-right-[9vmin]" : "-left-[9vmin]"}`} style={{ background: INK }}>
                <span className="absolute top-[.8vmin] h-[1.6vmin] w-[.7vmin] rounded-full bg-white/70" />
              </div>
            ))}
            <div aria-hidden className="pointer-events-none absolute -bottom-[9vmin] left-1/2 z-[240] h-[5vmin] w-[62%] -translate-x-1/2 rounded-b-[2vmin] rounded-t-sm" style={{ background: INK }} />
          </div>

          <nav aria-label="Jump to a card" className="absolute bottom-16 flex max-w-[94vw] gap-1 overflow-x-auto md:bottom-14">
            {CARDS.map((c, i) => (
              <button key={c.tab} type="button" onClick={() => goTo(i)} aria-current={current === i ? "true" : undefined} aria-label={`Card ${c.tab}: ${c.title || "your first card"}`}
                className={`size-8 shrink-0 rounded-md font-mono text-xs font-semibold transition-colors duration-150 ${current === i ? "bg-[#1a1a18] text-white" : "hover:bg-black/15"}`}>{c.tab}</button>
            ))}
          </nav>
        </div>
      </main>
    </div>
  );
}
