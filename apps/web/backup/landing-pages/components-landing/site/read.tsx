"use client";
import { useEffect, useRef, useState } from "react";
import { ease, reducedMotion, seg, useFrame, type Tone } from "../shared";
import { useSmoothProgress } from "../v3/kit";
import { InstallButton } from "./install-button";

/* Act two. A paragraph written in addresses, read with a lens. The lens is what the extension does to a page. */

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

export function ReadingStage() {
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

  useEffect(() => { if (reducedMotion()) setFound(Array(COUNT).fill(true)); }, []);
  useSmoothProgress(root, (p) => { lens.current.grow = ease(seg(p, 0.15, 0.9)); });

  const count = found.filter(Boolean).length;
  return (
    <section ref={root} className="h-[220vh]" aria-label="How a page reads with the extension">
      <div className="sticky top-0 flex h-dvh flex-col justify-center overflow-hidden px-5 pb-14 pt-16">
        <div className="mx-auto w-full max-w-6xl">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight md:text-4xl">Know who&apos;s behind every wallet.</h2>
              <p className="mt-1 text-muted md:text-lg">With the extension on, every page reads like this.</p>
            </div>
            <p aria-live="polite" className="text-sm text-muted">{count === COUNT ? "All found. Names you've read stay read." : `Move the lens over the addresses. ${count} of ${COUNT} found.`}</p>
          </div>
          <div ref={area} onPointerMove={(e) => { const r = area.current!.getBoundingClientRect(); lens.current.tx = e.clientX - r.left; lens.current.ty = e.clientY - r.top; lens.current.last = performance.now() / 1000; }}
            className="relative mt-8 touch-pan-y select-none text-[clamp(1.75rem,4.8vw,4.5rem)] font-semibold leading-[1.28] tracking-[-0.025em]">
            <div ref={addrs} aria-hidden><Layer names={false} found={found} tokenRefs={tokens} /></div>
            <div ref={names} className="absolute inset-0" style={{ maskImage: "radial-gradient(circle 0 at 50% 50%, #000, transparent)" }}><Layer names found={found} /></div>
            <div ref={ring} aria-hidden className="pointer-events-none absolute left-0 top-0 rounded-full border-2 border-accent shadow-[0_0_50px_-8px_var(--accent)]" style={{ width: 0, height: 0 }} />
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-5">
            <InstallButton />
            <p className="max-w-md text-sm text-muted">Free for Chrome, Brave and Edge. The name you give an address shows up beside it on explorers, X and the DeFi apps you turn it on for.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
