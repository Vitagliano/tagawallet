"use client";
import { useRef, useState } from "react";
import { MARK_FILL } from "@/components/brand-mark";
import { MARK_PARTS } from "@/components/brand-mark-paths";
import { Chip, ease, reducedMotion, seg, useFrame, useScrollProgress } from "../shared";

/* Act three. The mark comes apart as you scroll and tells how the product fits together, one piece at a time. */

/** How deep each piece sits for cursor parallax, in viewBox units. */
const DEPTH: Record<string, number> = { body: 8, flap: 14, clasp: 22, tag: 30, shoulders: 38, head: 44, sparkA: 56, sparkB: 62 };

const CHAPTERS = [
  { at: 0.06, side: "left", title: "A wallet tells you nothing.", body: "On-chain, everyone is a string of characters. Easy to confuse, and easy to imitate, as Alice's lookalikes showed." },
  { at: 0.3, side: "right", title: "So give it a tag.", body: "Name an address once, privately. Lists, notes and labels are yours alone until you invite someone." },
  { at: 0.52, side: "left", title: "Put a person behind it.", body: "Group every wallet a person, project, DAO or exchange uses across chains, with the links that back it up. Every tag says who tied it: you, your team, the owner, or a verified profile." },
  { at: 0.76, side: "right", title: "Then meet it everywhere.", body: "The extension puts that name beside the address on explorers, X and the DeFi apps you turn it on for. Page content never leaves your browser." },
];

const ORBIT = [
  { name: "Alice, OTC desk", source: "Private", tone: "mine" as const, x: -46, y: -36 },
  { name: "Exchange hot wallet", source: "Verified", tone: "good" as const, x: 44, y: -40 },
  { name: "DAO treasury", source: "Shared", tone: "warn" as const, x: -48, y: 34 },
  { name: "Grants multisig", source: "Self-claimed", tone: "accent" as const, x: 42, y: 38 },
];

export function MarkStory() {
  const root = useRef<HTMLElement>(null);
  const parts = useRef<Record<string, SVGPathElement | null>>({});
  const mark = useRef<SVGSVGElement>(null);
  const chips = useRef<(HTMLDivElement | null)[]>([]);
  const addr = useRef<HTMLParagraphElement>(null);
  const progress = useRef(0);
  const cursor = useRef({ x: 0, y: 0, tx: 0, ty: 0, side: 0 });
  const [chapter, setChapter] = useState(-1);

  const paint = (t: number) => {
    const p = progress.current, c = cursor.current;
    // Open > tag rises > person grows > snap back together, then the names orbit.
    const open = ease(seg(p, 0.04, 0.26)) * (1 - ease(seg(p, 0.68, 0.82)));
    const rise = ease(seg(p, 0.22, 0.4)) * (1 - ease(seg(p, 0.7, 0.84)));
    const person = ease(seg(p, 0.46, 0.58)) * (1 - ease(seg(p, 0.7, 0.82)));
    const transforms: Record<string, string> = {
      flap: `translate(${open * 18}px, ${-open * 70}px) rotate(${open * 9}deg)`,
      clasp: `translate(${open * 70}px, ${open * 6}px)`,
      body: `translate(${open * 34}px, ${open * 34}px)`,
      tag: `translate(${-rise * 44}px, ${-rise * 52}px) rotate(${-rise * 8}deg)`,
      shoulders: `translate(${-rise * 44}px, ${-rise * 52 - person * 18}px)`,
      head: `translate(${-rise * 44}px, ${-rise * 52 - person * 34}px)`,
      sparkA: `translate(${-open * 40}px, ${-open * 14}px)`,
      sparkB: `translate(${-open * 26}px, ${-open * 36}px)`,
    };
    for (const part of MARK_PARTS) {
      const el = parts.current[part.id];
      if (!el) continue;
      const d = DEPTH[part.id];
      const idle = part.id.startsWith("spark") ? Math.sin(t * 2 + d) * 4 : 0;
      el.style.transform = `translate(${c.x * d}px, ${c.y * d + idle}px) ${transforms[part.id]}`;
    }
    if (mark.current) {
      const s = 1 - ease(seg(p, 0.9, 1)) * 0.25;
      // Make room for the chapter copy: sideways on wide screens, upward on narrow ones.
      const wide = innerWidth >= 1024;
      let side = 0;
      CHAPTERS.forEach((ch, i) => { if (p >= ch.at) side = (i < CHAPTERS.length - 1 || p < 0.97) ? (ch.side === "left" ? 1 : -1) : 0; });
      c.side += (side - c.side) * 0.08;
      const lift = wide ? 0 : -13;
      mark.current.style.transform = `translate(${wide ? c.side * 15 : 0}vw, ${lift}vh) scale(${wide ? s * 0.86 : s * 0.82})`;
    }
    if (addr.current) addr.current.style.opacity = String(seg(p, 0.04, 0.1) * (1 - seg(p, 0.22, 0.28)));
    const orbit = ease(seg(p, 0.78, 0.86));
    chips.current.forEach((el, i) => {
      if (!el) return;
      const o = ORBIT[i], f = Math.sin(t * 0.8 + i * 2) * 1.2;
      el.style.opacity = String(orbit);
      el.style.transform = `translate(-50%, -50%) translate(${o.x * orbit * (innerWidth < 760 ? 0.5 : 0.8)}vw, ${(o.y + f) * orbit}vh) translate(${c.x * 60}px, ${c.y * 60}px)`;
    });
  };

  useScrollProgress(root, (p) => {
    progress.current = p;
    let at = -1;
    CHAPTERS.forEach((ch, i) => { if (p >= ch.at) at = i; });
    setChapter(at);
    if (reducedMotion()) paint(0);
  });
  useFrame(root, (dt, t) => {
    const c = cursor.current, k = 1 - Math.pow(0.002, dt);
    c.x += (c.tx - c.x) * k; c.y += (c.ty - c.y) * k;
    paint(t);
  });

  const onMove = (e: React.PointerEvent) => {
    cursor.current.tx = (e.clientX / innerWidth - 0.5) * 2;
    cursor.current.ty = (e.clientY / innerHeight - 0.5) * 2;
  };
  const ch = chapter >= 0 ? CHAPTERS[chapter] : null;

  return (
    <section ref={root} onPointerMove={onMove} className="h-[460vh]" aria-label="How TagAWallet works">
      <div className="sticky top-0 grid h-dvh place-items-center overflow-hidden">
        <svg ref={mark} viewBox="-70 -110 655 610" className="absolute size-[min(74vw,62vh)] overflow-visible will-change-transform md:size-[min(52vw,70vh)]" aria-hidden fill="none" style={{ transform: "translateY(-13vh) scale(.82)", color: "var(--ink)" }}>
          {MARK_PARTS.map((part) => (
            <path key={part.id} ref={(el) => { parts.current[part.id] = el; }} d={part.d} fill={MARK_FILL[part.tone]} fillRule={part.evenodd ? "evenodd" : undefined} clipRule={part.evenodd ? "evenodd" : undefined} style={{ transformBox: "fill-box", transformOrigin: "center", willChange: "transform" }} />
          ))}
        </svg>
        <p ref={addr} className="addr pointer-events-none absolute top-[12%] text-center text-base text-muted opacity-0 md:text-2xl" aria-hidden>0x4c1fA8e27B03d96E5f71aC…637fA92c15</p>
        {ORBIT.map((o, i) => (
          <div key={o.name} ref={(el) => { chips.current[i] = el; }} className="absolute left-1/2 top-1/2 opacity-0" style={{ transform: "translate(-50%,-50%)" }} aria-hidden><Chip className="px-2.5 py-1 text-sm shadow-md" {...o} /></div>
        ))}
        {ch && (
          <div key={chapter} className={`pop absolute inset-x-4 bottom-16 rounded-xl border border-line bg-paper/90 p-5 backdrop-blur lg:inset-x-auto lg:top-1/2 lg:bottom-auto lg:w-[28vw] lg:max-w-sm lg:-translate-y-1/2 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none ${ch.side === "left" ? "lg:left-[6vw]" : "lg:right-[6vw]"}`}>
            <h2 className="text-2xl font-semibold leading-tight tracking-tight lg:text-4xl">{ch.title}</h2>
            <p className="mt-2 text-sm text-muted lg:text-base">{ch.body}</p>
          </div>
        )}
      </div>
    </section>
  );
}
