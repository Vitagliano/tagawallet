"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Cta, ease, reducedMotion, seg, useFrame, type Tone } from "../shared";
import { PillNav, useSmoothProgress } from "../v3/kit";
import { CREAM, INK, NotAWallet, ORANGE, STATEMENTS, Statement } from "../v3/names";

/* Lens + Names. The lens stops being a decoration over a wall: you read a story with it. */

const TONE: Record<Tone, string> = { mine: "bg-wash text-ink", good: "bg-good/15 text-good", warn: "bg-warn/15 text-warn", accent: "bg-accent/15 text-accent" };
type Word = string | { addr: string; name: string; tone: Tone; id: number };
const STORY: Word[] = [
  "Yesterday",
  { id: 0, addr: "0x4c1f…2c15", name: "Alice, your OTC desk,", tone: "accent" },
  "paid",
  { id: 1, addr: "0x9e0b…77d1", name: "the DAO treasury", tone: "warn" },
  "right after a transfer from",
  { id: 2, addr: "0xb71a…40ce", name: "an exchange.", tone: "good" },
  "Then the money moved to",
  { id: 3, addr: "0x03fd…a98b", name: "your own cold storage.", tone: "mine" },
];
const COUNT = 4;

function Layer({ names, found, tokenRefs }: { names: boolean; found: boolean[]; tokenRefs?: React.RefObject<(HTMLSpanElement | null)[]> }) {
  return (
    <>
      {STORY.map((w, i) => {
        if (typeof w === "string") return <span key={i}>{w} </span>;
        const show = names || found[w.id];
        return (
          <span key={i} ref={tokenRefs ? (el) => { tokenRefs.current[w.id] = el; } : undefined} className="inline-grid align-baseline">
            {/* Both faces share a cell, so the two layers line up exactly. */}
            <span className={`addr col-start-1 row-start-1 whitespace-nowrap text-muted transition-opacity duration-300 ${show ? "opacity-0" : ""}`} style={{ fontSize: ".8em", alignSelf: "center" }}>{w.addr}</span>
            <span className={`col-start-1 row-start-1 whitespace-nowrap rounded-[.18em] px-[.16em] transition-opacity duration-300 ${TONE[w.tone]} ${show ? "" : "opacity-0"}`}>{w.name}</span>{" "}
          </span>
        );
      })}
    </>
  );
}

function ReadingStage({ signedIn }: { signedIn: boolean }) {
  const root = useRef<HTMLElement>(null);
  const area = useRef<HTMLDivElement>(null);
  const names = useRef<HTMLDivElement>(null);
  const addrs = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const tokens = useRef<(HTMLSpanElement | null)[]>([]);
  const lens = useRef({ x: -400, y: 900, tx: -400, ty: 900, last: performance.now() / 1000 + 1.6, r: 90, grow: 0 });
  const dwell = useRef(Array(COUNT).fill(0));
  const [found, setFound] = useState<boolean[]>(() => Array(COUNT).fill(false));
  const foundRef = useRef(found); foundRef.current = found;

  const tokenCenter = (i: number) => {
    const b = area.current!.getBoundingClientRect(), r = tokens.current[i]!.getBoundingClientRect();
    return { x: r.left - b.left + r.width / 2, y: r.top - b.top + r.height / 2 };
  };

  useFrame(root, (dt, t) => {
    const el = area.current, c = lens.current;
    if (!el || !tokens.current[COUNT - 1]) return;
    const W = el.clientWidth, H = el.clientHeight;
    // Left alone, the lens drifts to the next unread name so the page reads itself.
    if (t - c.last > 2.6) {
      const next = foundRef.current.findIndex((v) => !v);
      if (next >= 0) { const p = tokenCenter(next); c.tx = p.x + Math.sin(t) * 16; c.ty = p.y + Math.cos(t * 1.3) * 6; }
      else { c.tx = W * (0.5 + 0.34 * Math.sin(t * 0.4)); c.ty = H * (0.55 + 0.25 * Math.sin(t * 0.7)); }
    }
    const k = 1 - Math.exp(-dt * (t - c.last > 2.6 ? 0.9 : 11));
    c.x += (c.tx - c.x) * k; c.y += (c.ty - c.y) * k;
    const base = Math.min(112, W * 0.24);
    c.r = base + (Math.hypot(W, H) * 1.1 - base) * c.grow;
    const at = `${c.x}px ${c.y}px`;
    names.current?.style.setProperty("mask-image", `radial-gradient(circle ${c.r}px at ${at}, #000 97%, transparent 100%)`);
    addrs.current?.style.setProperty("mask-image", `radial-gradient(circle ${c.r}px at ${at}, transparent 97%, #000 100%)`);
    if (ring.current) { ring.current.style.transform = `translate(${c.x - c.r}px, ${c.y - c.r}px)`; ring.current.style.width = ring.current.style.height = `${c.r * 2}px`; ring.current.style.opacity = String(1 - seg(c.grow, 0.1, 0.5)); }
    // A name you've read stays read.
    for (let i = 0; i < COUNT; i++) {
      if (foundRef.current[i]) continue;
      const p = tokenCenter(i);
      // Reading takes a moment: passing over a name quickly doesn't count.
      dwell.current[i] = Math.hypot(p.x - c.x, p.y - c.y) < c.r * 0.6 ? dwell.current[i] + dt : 0;
      if (dwell.current[i] > 0.5 || c.grow > 0.5) { setFound((f) => f.map((v, k2) => (k2 === i ? true : v))); break; }
    }
  });

  useEffect(() => {
    if (reducedMotion()) setFound(Array(COUNT).fill(true));
  }, []);

  useSmoothProgress(root, (p) => { lens.current.grow = ease(seg(p, 0.15, 0.9)); });

  const count = found.filter(Boolean).length;
  return (
    <section ref={root} className="h-[240vh]">
      <div className="sticky top-0 flex h-dvh flex-col justify-center overflow-hidden px-5 pb-14 pt-20">
        <div className="mx-auto w-full max-w-6xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-lg font-semibold tracking-tight md:text-2xl">Know who&apos;s behind every wallet.</h1>
            <p aria-live="polite" className="text-sm text-muted">{count === COUNT ? "All found. This is how every page could read." : `Move the lens over the addresses. ${count} of ${COUNT} found.`}</p>
          </div>
          <div ref={area} onPointerMove={(e) => { const r = area.current!.getBoundingClientRect(); lens.current.tx = e.clientX - r.left; lens.current.ty = e.clientY - r.top; lens.current.last = performance.now() / 1000; }}
            className="relative mt-6 touch-pan-y select-none text-[clamp(2rem,5.5vw,5.25rem)] font-semibold leading-[1.28] tracking-[-0.025em]">
            <div ref={addrs} aria-hidden><Layer names={false} found={found} tokenRefs={tokens} /></div>
            <div ref={names} className="absolute inset-0" style={{ maskImage: "radial-gradient(circle 0 at 50% 50%, #000, transparent)" }}><Layer names found={found} /></div>
            <div ref={ring} aria-hidden className="pointer-events-none absolute left-0 top-0 rounded-full border-2 border-accent shadow-[0_0_50px_-8px_var(--accent)]" style={{ width: 0, height: 0 }} />
          </div>
          <div className="mt-7 flex flex-wrap items-center gap-4">
            <Cta signedIn={signedIn} />
            <p className="max-w-md text-sm text-muted">Privately tag addresses, link socials, group related wallets, and recognize identities wherever you research and trade.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* The statements from Names, but each new color opens like the lens, from wherever your cursor is. */
function LensColors() {
  const base = useRef<HTMLDivElement>(null);
  const top = useRef<HTMLDivElement>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const current = useRef<string>(CREAM);

  useEffect(() => {
    pointer.current = { x: innerWidth / 2, y: innerHeight / 2 };
    const on = (e: PointerEvent) => { pointer.current = { x: e.clientX, y: e.clientY }; };
    addEventListener("pointermove", on, { passive: true });
    return () => removeEventListener("pointermove", on);
  }, []);

  const change = useCallback((bg: string) => {
    if (bg === current.current || !base.current || !top.current) return;
    base.current.style.background = current.current;
    current.current = bg;
    top.current.style.background = bg;
    if (reducedMotion()) return;
    const at = `at ${pointer.current.x}px ${pointer.current.y}px`;
    top.current.animate([{ clipPath: `circle(0px ${at})` }, { clipPath: `circle(${Math.hypot(innerWidth, innerHeight) * 1.1}px ${at})` }], { duration: 850, easing: "cubic-bezier(.3,.7,.2,1)" });
  }, []);
  const handlers = useRef(STATEMENTS.map((s) => () => change(s.bg)));
  const toCream = useCallback(() => change(CREAM), [change]);

  return (
    <div className="relative">
      <div className="sticky top-0 -mb-[100dvh] h-dvh overflow-hidden" aria-hidden>
        <div ref={base} className="absolute inset-0" style={{ background: CREAM }} />
        <div ref={top} className="absolute inset-0" style={{ background: CREAM }} />
      </div>
      <div className="relative">
        {STATEMENTS.map((s, i) => <Statement key={s.a} s={s} onActive={handlers.current[i]} />)}
        <NotAWallet onActive={toCream} />
      </div>
    </div>
  );
}

/* Footer: the address under the lens is our name, and scrolling opens the lens fully. */
function LensFooter({ signedIn }: { signedIn: boolean }) {
  const root = useRef<HTMLElement>(null);
  const word = useRef<HTMLDivElement>(null);
  const hex = useRef<HTMLSpanElement>(null);
  const s = useRef({ x: 0.5, y: 0.5, r: 0 });
  const paint = () => {
    const c = s.current, at = `${c.x * 100}% ${c.y * 100}%`;
    word.current?.style.setProperty("mask-image", `radial-gradient(circle ${c.r}vw at ${at}, #000 97%, transparent 100%)`);
    hex.current?.style.setProperty("mask-image", `radial-gradient(circle ${c.r}vw at ${at}, transparent 97%, #000 100%)`);
  };
  useSmoothProgress(root, (p) => { s.current.r = 13 + ease(seg(p, 0.55, 1)) * 110; paint(); });
  return (
    <footer ref={root} className="overflow-hidden" style={{ background: ORANGE, color: INK }}>
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-end justify-between gap-6 px-5 pt-20 md:px-8">
        <div>
          <p className="text-[clamp(2.75rem,7vw,6.5rem)] font-semibold leading-[.98] tracking-[-0.035em]">Now read every page like this.</p>
          <Link href={signedIn ? "/dashboard" : "/signup"} className="mt-7 inline-flex items-center gap-2 rounded-full bg-[#1a1a18] px-7 py-4 text-lg font-medium text-white transition-transform duration-200 hover:scale-[1.04] active:scale-95">
            {signedIn ? "Open dashboard" : "Start tagging, it's free"}<span className="cta-arrow" aria-hidden>→</span>
          </Link>
        </div>
        <span className="flex gap-5 text-sm font-medium"><span>© {new Date().getFullYear()} TagAWallet</span><Link href="/privacy" className="hover:underline">Privacy</Link><Link href="/terms" className="hover:underline">Terms</Link></span>
      </div>
      <div role="img" aria-label="TagAWallet" className="relative mt-8 grid h-[21vw] select-none place-items-center pb-16 md:pb-4"
        onPointerMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); s.current.x = (e.clientX - r.left) / r.width; s.current.y = (e.clientY - r.top) / r.height; paint(); }}>
        <span ref={hex} aria-hidden className="absolute whitespace-nowrap font-mono text-[12vw] leading-none opacity-40">0x7a25…488D</span>
        <div ref={word} aria-hidden className="absolute inset-0 grid place-items-center"><span className="whitespace-nowrap text-[17vw] font-semibold leading-none tracking-[-0.04em]">TagAWallet</span></div>
      </div>
    </footer>
  );
}

export function RevealLanding({ signedIn }: { signedIn: boolean }) {
  return (
    <>
      <PillNav signedIn={signedIn} />
      <main>
        <ReadingStage signedIn={signedIn} />
        <LensColors />
      </main>
      <LensFooter signedIn={signedIn} />
    </>
  );
}
