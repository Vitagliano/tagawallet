"use client";
import { useRef, useState } from "react";
import { Cta, clamp, ease, reducedMotion, seg, useFrame } from "../shared";
import { TagsFooter } from "../v1/tags";
import { PillNav, useSmoothProgress } from "../v3/kit";
import { AMBER, CREAM, GREEN, INK, ORANGE, STATEMENTS } from "../v3/names";

/* Tags + Names. One rope carries the whole page. Everything hangs from it, swings with your scroll, then it snaps. */

const ROPE_Y = 74;
type Small = { kind: "small"; name: string; source: string; bg: string; fg: string; left: string; len: number };
const SMALL: Small[] = [
  { kind: "small", name: "Alice, OTC desk", source: "Private", bg: "#fffefb", fg: INK, left: "48vw", len: 70 },
  { kind: "small", name: "DAO treasury", source: "Shared", bg: AMBER, fg: INK, left: "60vw", len: 190 },
  { kind: "small", name: "Exchange hot wallet", source: "Verified", bg: GREEN, fg: "#fff", left: "73vw", len: 100 },
  { kind: "small", name: "My cold storage", source: "Private", bg: INK, fg: "#fff", left: "88vw", len: 230 },
];
// Stage color behind each big tag, and the tag's own color.
const BIG = [
  { stage: ORANGE, bg: "#fffefb", fg: INK },
  { stage: CREAM, bg: INK, fg: "#f6f4ee" },
  { stage: INK, bg: "#fffefb", fg: INK },
  { stage: GREEN, bg: "#fffefb", fg: INK },
  { stage: AMBER, bg: "#fffefb", fg: INK },
];
const COUNT_BIG = BIG.length;
const leftOfBig = (i: number) => `calc(var(--start) + ${i} * var(--step))`;

function MiniChat({ stamped }: { stamped: boolean }) {
  return (
    <div className="flex flex-col gap-2 text-sm md:text-base">
      <p className="w-fit rounded-2xl rounded-bl-sm bg-wash px-3 py-2 text-[#1a1a18]" style={{ background: "#efece2" }}>Who did we pay last week?</p>
      <div className="relative ml-auto w-fit max-w-[92%] rounded-2xl rounded-br-sm bg-[#1a1a18] px-3 py-2 text-white">
        <span className={`font-mono text-xs transition-all duration-300 ${stamped ? "opacity-25 blur-[1.5px]" : ""}`}>0x4c1fA8e27B03d96E5f71aC28D04bE6637fA92c15</span>
        {stamped && <span className="stamp absolute inset-0 grid place-items-center"><span className="whitespace-nowrap rounded-l-full rounded-r-lg px-3 py-1 font-semibold shadow-xl" style={{ background: ORANGE, color: INK }}>Alice, OTC desk</span></span>}
      </div>
      <p className={`w-fit rounded-2xl rounded-bl-sm px-3 py-2 text-[#1a1a18] transition-opacity duration-500 ${stamped ? "opacity-100" : "opacity-0"}`} style={{ background: "#efece2" }}>Oh, Alice! Why didn&apos;t you say so?</p>
    </div>
  );
}

function RopeStage({ signedIn }: { signedIn: boolean }) {
  const root = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const rope = useRef<SVGPathElement>(null);
  const hangers = useRef<(HTMLDivElement | null)[]>([]);
  const heroCopy = useRef<HTMLDivElement>(null);
  const total = SMALL.length + COUNT_BIG;
  const swing = useRef(Array.from({ length: total }, (_, i) => ({ a: 0, v: i % 2 ? 0.1 : -0.1 })));
  const grab = useRef<{ i: number; x: number; y: number } | null>(null);
  const scroll = useRef({ p: 0, x: 0, lastX: 0, vel: 0, wave: 0 });
  const [active, setActive] = useState(-1);
  const [stageColor, setStageColor] = useState<string>("var(--paper)");

  const render = (t: number) => {
    const el = track.current, s = scroll.current;
    if (!el) return;
    const width = el.scrollWidth;
    const snap = seg(s.p, 0.86, 0.97);
    // The line: a shallow sag that bounces when you scroll fast, then falls away once it breaks.
    const sag = 20 + Math.abs(s.wave) * 0.5;
    const points: string[] = [];
    const steps = 40, breakAt = 0.8;
    for (let i = 0; i <= steps; i++) {
      const u = i / steps, x = u * width;
      const y = ROPE_Y + Math.sin(u * Math.PI * 9) * sag * 0.5 + Math.sin(u * 40 + t * 2) * Math.min(8, Math.abs(s.wave) * 0.15);
      const drop = snap > 0 && u > breakAt - (snap * 0.6) ? ((u - (breakAt - snap * 0.6)) * snap * innerHeight * 3) : 0;
      points.push(`${x.toFixed(0)},${(y + drop).toFixed(1)}`);
    }
    rope.current?.setAttribute("d", `M ${points.join(" L ")}`);
    hangers.current.forEach((h, i) => {
      if (!h) return;
      const fall = clamp(snap * 1.9 - (total - 1 - i) * 0.09);
      const b = swing.current[i];
      h.style.transform = `translateY(${fall * fall * 130}vh) rotate(${b.a.toFixed(4)}rad) rotate(${(fall * (i % 2 ? 40 : -40)).toFixed(1)}deg)`;
    });
  };

  useFrame(root, (dt, t) => {
    const s = scroll.current;
    // Moving the track swings everything on it, in the direction it was left behind.
    const accel = (s.vel - s.wave) * 0.9;
    s.wave += (s.vel - s.wave) * Math.min(1, dt * 6);
    s.vel *= Math.exp(-dt * 5);
    swing.current.forEach((b, i) => {
      const h = hangers.current[i];
      if (!h) return;
      if (grab.current?.i === i) {
        const anchorX = track.current ? h.offsetLeft + track.current.getBoundingClientRect().left : 0;
        const target = Math.atan2(grab.current.x - anchorX, Math.max(40, grab.current.y - ROPE_Y));
        const na = clamp(-target, -1.2, 1.2);
        b.v = (na - b.a) / Math.max(dt, 0.01) * 0.5; b.a = na;
        return;
      }
      const f = -b.a * (i < SMALL.length ? 14 : 7) - b.v * 1.05 + clamp(accel * 0.0009, -6, 6) + Math.sin(t * 0.8 + i * 1.3) * 0.05;
      b.v += f * dt; b.a += b.v * dt;
    });
    render(t);
  });

  useSmoothProgress(root, (p) => {
    const s = scroll.current, el = track.current;
    if (!el) return;
    s.p = p;
    const x = p * Math.max(0, el.scrollWidth - innerWidth);
    s.vel += (x - s.lastX) * 2.2; s.lastX = x; s.x = x;
    el.style.transform = `translateX(${-x}px)`;
    if (heroCopy.current) heroCopy.current.style.opacity = String(1 - seg(x / innerWidth, 0.5, 0.95));
    // Whichever big tag is nearest the middle of the screen sets the mood.
    let best = -1, dist = innerWidth * 0.42;
    for (let i = 0; i < COUNT_BIG; i++) {
      const h = hangers.current[SMALL.length + i];
      if (!h) continue;
      const d = Math.abs(h.offsetLeft - x - innerWidth / 2);
      if (d < dist) { dist = d; best = i; }
    }
    setActive(best);
    setStageColor(best >= 0 ? BIG[best].stage : seg(p, 0.86, 0.9) > 0 ? ORANGE : "var(--paper)");
    if (reducedMotion()) render(0);
  }, 8);

  const onDown = (i: number) => (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || (e.target as HTMLElement).closest("button,a")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    grab.current = { i, x: e.clientX, y: e.clientY };
  };
  const onMove = (e: React.PointerEvent) => { if (grab.current) { grab.current.x = e.clientX; grab.current.y = e.clientY; } };
  const onUp = () => { grab.current = null; };

  return (
    <section ref={root} className="h-[620vh]" aria-label="Everything hanging from one rope">
      <div ref={stage} className="sticky top-0 h-dvh select-none overflow-hidden transition-colors duration-500 [--start:150vw] [--step:90vw] md:[--start:112vw] md:[--step:50vw]" style={{ background: stageColor }} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <div ref={track} className="absolute inset-y-0 left-0 will-change-transform" style={{ width: `calc(var(--start) + ${COUNT_BIG} * var(--step) + 90vw)` }}>
          <svg aria-hidden className="pointer-events-none absolute inset-0 size-full overflow-visible"><path ref={rope} fill="none" stroke="#6a675e" strokeWidth="2" /></svg>

          <div ref={heroCopy} className="absolute bottom-20 left-[4vw] z-10 w-[min(92vw,720px)] md:bottom-16">
            <h1 className="rise text-[clamp(2.9rem,7vw,6.75rem)] font-semibold leading-[.98] tracking-[-0.035em]">Know who&apos;s behind every wallet.</h1>
            <p className="rise mt-4 max-w-lg text-muted md:text-lg" style={{ "--d": "120ms" } as React.CSSProperties}>Privately tag addresses, link socials, group related wallets, and recognize identities wherever you research and trade.</p>
            <div className="rise mt-5" style={{ "--d": "200ms" } as React.CSSProperties}><Cta signedIn={signedIn} /></div>
          </div>

          {SMALL.map((t, i) => (
            <div key={t.name} ref={(el) => { hangers.current[i] = el; }} className="absolute origin-top" style={{ left: t.left, top: ROPE_Y }}>
              <div className="absolute left-0 top-0 w-px bg-[#6a675e]" style={{ height: t.len }} aria-hidden />
              <div onPointerDown={onDown(i)} onLostPointerCapture={onUp} className="absolute -translate-x-1/2 cursor-grab whitespace-nowrap rounded-xl px-3.5 pb-2.5 pt-6 font-semibold shadow-xl active:cursor-grabbing md:text-lg" style={{ top: t.len, background: t.bg, color: t.fg, border: t.bg === "#fffefb" ? "1px solid #dfdbcf" : undefined }}>
                <span className="absolute left-1/2 top-2 size-2.5 -translate-x-1/2 rounded-full bg-paper ring-1 ring-black/25" aria-hidden />
                {t.name}<span className="block text-xs font-normal opacity-75">{t.source}</span>
              </div>
            </div>
          ))}

          {BIG.map((b, i) => {
            const statement = i === 0 ? null : STATEMENTS[i - 1];
            return (
              <div key={i} ref={(el) => { hangers.current[SMALL.length + i] = el; }} className="absolute origin-top" style={{ left: leftOfBig(i), top: ROPE_Y }}>
                <div className="absolute left-0 top-0 w-px bg-[#6a675e]" style={{ height: 46 }} aria-hidden />
                <article onPointerDown={onDown(SMALL.length + i)} onLostPointerCapture={onUp} className="absolute flex w-[min(84vw,520px)] -translate-x-1/2 cursor-grab flex-col rounded-[2rem] p-7 pt-14 shadow-[0_40px_80px_-30px_rgba(0,0,0,.55)] active:cursor-grabbing md:p-10 md:pt-16" style={{ top: 46, minHeight: "min(66dvh, 520px)", background: b.bg, color: b.fg }}>
                  <span className="absolute left-1/2 top-5 size-5 -translate-x-1/2 rounded-full ring-1 ring-black/25" style={{ background: BIG[i].stage }} aria-hidden />
                  {statement ? (
                    <>
                      <h2 className="text-[clamp(2.25rem,4.2vw,3.75rem)] font-semibold leading-[1.12] tracking-[-0.03em]">{statement.a} {statement.glyph} {statement.b}</h2>
                      <p className="mt-auto pt-6 opacity-75 md:text-lg">{statement.body}</p>
                    </>
                  ) : (
                    <>
                      <h2 className="text-[clamp(2rem,3.6vw,3.25rem)] font-semibold leading-[1.05] tracking-[-0.03em]">Addresses were never meant for people.</h2>
                      <div className="mt-auto pt-6"><MiniChat stamped={active === 0} /></div>
                    </>
                  )}
                </article>
              </div>
            );
          })}

          <div className="absolute inset-y-0 right-0 grid w-[90vw] place-items-center px-6 text-center" style={{ color: INK }}>
            <p className="text-[clamp(2.75rem,8vw,7.5rem)] font-semibold leading-[1] tracking-[-0.035em]">Tags don&apos;t stay up<br />on their own.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function HangLanding({ signedIn }: { signedIn: boolean }) {
  return (
    <>
      <PillNav signedIn={signedIn} />
      <main><RopeStage signedIn={signedIn} /></main>
      {/* The tags that fell off the rope land here. */}
      <TagsFooter signedIn={signedIn} title="Catch one. Make it yours." color={{ bg: ORANGE, fg: INK }} />
    </>
  );
}
