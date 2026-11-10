"use client";
import { useRef, useState } from "react";
import { MARK_FILL } from "@/components/brand-mark";
import { MARK_PARTS } from "@/components/brand-mark-paths";
import { CHAINS, Chip, Cta, FootLinks, NOT_A_WALLET, Nav, POINTS, Reveal, ease, reducedMotion, seg, useFrame, useScrollProgress } from "../shared";

/** How deep each piece sits for cursor parallax, in viewBox units. */
const DEPTH: Record<string, number> = { body: 8, flap: 14, clasp: 22, tag: 30, shoulders: 38, head: 44, sparkA: 56, sparkB: 62 };

const CHAPTERS = [
  { at: 0.12, side: "left", title: "A wallet tells you nothing.", body: "On-chain, everyone is a string of characters. Easy to confuse, impossible to remember." },
  { at: 0.34, side: "right", title: "So give it a tag.", body: POINTS[0].body },
  { at: 0.56, side: "left", title: "Put a person behind it.", body: POINTS[1].body },
  { at: 0.78, side: "right", title: "Then see it everywhere.", body: POINTS[3].body },
];

const ORBIT = [
  { name: "Alice, OTC desk", source: "Private", tone: "mine" as const, x: -46, y: -36 },
  { name: "Exchange hot wallet", source: "Verified", tone: "good" as const, x: 44, y: -40 },
  { name: "DAO treasury", source: "Shared", tone: "warn" as const, x: -48, y: 34 },
  { name: "Grants multisig", source: "Self-claimed", tone: "accent" as const, x: 42, y: 38 },
];

function Stage({ signedIn }: { signedIn: boolean }) {
  const root = useRef<HTMLElement>(null);
  const parts = useRef<Record<string, SVGPathElement | null>>({});
  const hero = useRef<HTMLDivElement>(null);
  const mark = useRef<SVGSVGElement>(null);
  const chips = useRef<(HTMLDivElement | null)[]>([]);
  const addr = useRef<HTMLParagraphElement>(null);
  const progress = useRef(0);
  const cursor = useRef({ x: 0, y: 0, tx: 0, ty: 0, side: 0 });
  const [chapter, setChapter] = useState(-1);

  const paint = (t: number) => {
    const p = progress.current, c = cursor.current;
    // Assemble > open > tag rises > person grows > snap back together.
    const open = ease(seg(p, 0.08, 0.3)) * (1 - ease(seg(p, 0.72, 0.86)));
    const rise = ease(seg(p, 0.24, 0.44)) * (1 - ease(seg(p, 0.74, 0.88)));
    const person = ease(seg(p, 0.48, 0.62)) * (1 - ease(seg(p, 0.74, 0.86)));
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
    const heroK = 1 - seg(p, 0, 0.08);
    if (hero.current) {
      hero.current.style.opacity = String(heroK);
      hero.current.style.transform = `translateY(${-(1 - heroK) * 50}px)`;
      hero.current.style.visibility = heroK <= 0 ? "hidden" : "visible";
    }
    if (mark.current) {
      // Starts low in the hero, settles to centre, shrinks away at the end.
      const y = (1 - ease(seg(p, 0, 0.1))) * 21;
      const s = (0.66 + ease(seg(p, 0, 0.1)) * 0.34) * (1 - ease(seg(p, 0.9, 1)) * 0.25);
      // Make room for the chapter copy: sideways on wide screens, upward on narrow ones.
      const wide = innerWidth >= 1024;
      let side = 0;
      CHAPTERS.forEach((ch, i) => { if (p >= ch.at) side = (i < 3 || p < 0.97) ? (ch.side === "left" ? 1 : -1) : 0; });
      c.side += (side - c.side) * 0.08;
      const lift = wide ? 0 : ease(seg(p, 0.08, 0.14)) * -13;
      mark.current.style.transform = `translate(${wide ? c.side * 15 : 0}vw, ${y + lift}vh) scale(${wide ? s * 0.86 : s * 0.82})`;
    }
    if (addr.current) addr.current.style.opacity = String(seg(p, 0.08, 0.12) * (1 - seg(p, 0.24, 0.3)));
    const orbit = ease(seg(p, 0.8, 0.88));
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
    setChapter(p > 0.97 ? -1 : at);
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
    <section ref={root} onPointerMove={onMove} className="h-[560vh]" aria-label="How TagAWallet works">
      <div className="sticky top-0 grid h-dvh place-items-center overflow-hidden">
        <svg ref={mark} viewBox="-70 -110 655 610" className="absolute size-[min(74vw,62vh)] overflow-visible will-change-transform md:size-[min(52vw,70vh)]" aria-hidden fill="none" style={{ transform: "translateY(21vh) scale(.66)", color: "var(--ink)" }}>
          {MARK_PARTS.map((part) => (
            <path key={part.id} ref={(el) => { parts.current[part.id] = el; }} d={part.d} fill={MARK_FILL[part.tone]} fillRule={part.evenodd ? "evenodd" : undefined} clipRule={part.evenodd ? "evenodd" : undefined} style={{ transformBox: "fill-box", transformOrigin: "center", willChange: "transform" }} />
          ))}
        </svg>
        <p ref={addr} className="addr pointer-events-none absolute top-[14%] text-center text-base text-muted opacity-0 md:text-2xl" aria-hidden>0x5aAeb6053F3E94C9b9A0…EF1BeAed</p>
        {ORBIT.map((o, i) => (
          <div key={o.name} ref={(el) => { chips.current[i] = el; }} className="absolute left-1/2 top-1/2 opacity-0" style={{ transform: "translate(-50%,-50%)" }} aria-hidden><Chip className="px-2.5 py-1 text-sm shadow-md" {...o} /></div>
        ))}
        <div ref={hero} className="absolute inset-x-0 top-20 px-4 text-center md:top-24">
          <h1 className="rise mx-auto max-w-4xl text-4xl font-semibold leading-[1.02] tracking-tight md:text-7xl">Know who&apos;s behind every wallet.</h1>
          <p className="rise mx-auto mt-4 max-w-xl text-muted md:text-lg" style={{ "--d": "120ms" } as React.CSSProperties}>Privately tag addresses, link socials, group related wallets, and recognize identities wherever you research and trade.</p>
          <div className="rise mt-5" style={{ "--d": "200ms" } as React.CSSProperties}><Cta signedIn={signedIn} /></div>
        </div>
        {ch && (
          <div key={chapter} className={`pop absolute inset-x-4 bottom-20 rounded-xl border border-line bg-paper/90 p-5 backdrop-blur lg:inset-x-auto lg:top-1/2 lg:bottom-auto lg:w-[28vw] lg:max-w-sm lg:-translate-y-1/2 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none ${ch.side === "left" ? "lg:left-[6vw]" : "lg:right-[6vw]"}`}>
            <h2 className="text-2xl font-semibold leading-tight tracking-tight lg:text-4xl">{ch.title}</h2>
            <p className="mt-2 text-sm text-muted lg:text-base">{ch.body}</p>
          </div>
        )}
      </div>
    </section>
  );
}

function BrandFooter({ signedIn }: { signedIn: boolean }) {
  const root = useRef<HTMLElement>(null);
  const word = useRef<HTMLParagraphElement>(null);
  useScrollProgress(root, (p) => { if (word.current) word.current.style.transform = `translateX(${(1 - p) * 10}%)`; });
  return (
    <footer ref={root} className="overflow-hidden bg-[#EE6A42] text-[#1a0d07]">
      <div className="mx-auto w-full max-w-6xl px-4 pb-6 pt-20">
        <p className="max-w-3xl text-5xl font-semibold leading-[1] tracking-tight md:text-7xl">Tag your first wallet.</p>
        <a href={signedIn ? "/dashboard" : "/signup"} className="mt-7 inline-flex items-center gap-2 rounded-md bg-[#1a0d07] px-5 py-3 font-medium text-white">{signedIn ? "Open dashboard" : "Start tagging, it's free"}<span className="cta-arrow" aria-hidden>→</span></a>
        <p className="mt-14 text-sm font-medium">{CHAINS.join("  ·  ")}</p>
        <FootLinks className="mt-3 pb-14" />
      </div>
      <p ref={word} aria-hidden className="-mb-[1.5vw] whitespace-nowrap text-center text-[17vw] font-semibold leading-none tracking-tighter text-white will-change-transform">TagAWallet</p>
    </footer>
  );
}

export function StoryLanding({ signedIn }: { signedIn: boolean }) {
  return (
    <>
      <Nav signedIn={signedIn} />
      <main>
        <Stage signedIn={signedIn} />
        <section className="mx-auto grid w-full max-w-5xl gap-8 px-4 py-20 md:grid-cols-2">
          <Reveal>
            <h2 className="text-2xl font-semibold tracking-tight">{POINTS[2].title}</h2>
            <p className="mt-2 text-muted">{POINTS[2].body}</p>
          </Reveal>
          <Reveal delay={90} className="rounded-xl bg-wash p-6">
            <h2 className="font-semibold">TagAWallet is not a wallet.</h2>
            <p className="mt-1.5 text-muted">{NOT_A_WALLET.replace("TagAWallet is not a wallet. ", "")}</p>
          </Reveal>
        </section>
      </main>
      <BrandFooter signedIn={signedIn} />
    </>
  );
}
