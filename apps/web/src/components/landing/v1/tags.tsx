"use client";
import { useEffect, useRef } from "react";
import { BrandMark } from "@/components/brand-mark";
import { Cta, FootLinks, NOT_A_WALLET, Nav, POINTS, ScrollWords, clamp, reducedMotion, useFrame, useInView, useScrollProgress } from "../shared";

const HANGING = [
  { name: "Alice, OTC desk", source: "Private", at: 0.42, len: 150, bg: "bg-card text-ink border-line" },
  { name: "DAO treasury", source: "Shared", at: 0.56, len: 300, bg: "bg-warn text-paper border-warn" },
  { name: "Exchange hot wallet", source: "Verified", at: 0.7, len: 190, bg: "bg-good text-paper border-good" },
  { name: "My cold storage", source: "Private", at: 0.86, len: 330, bg: "bg-accent text-accent-ink border-accent" },
  { name: "Who is this?", source: "Tag it", at: 0.97, len: 130, bg: "bg-card text-muted border-line border-dashed" },
];
const SEGMENTS = 7;
type P = { x: number; y: number; px: number; py: number };

/** Verlet ropes, each with a draggable tag on the end. */
function HangingTags() {
  const root = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const tagEls = useRef<(HTMLDivElement | null)[]>([]);
  const ropes = useRef<P[][]>([]);
  const drag = useRef<{ i: number; x: number; y: number } | null>(null);
  const wind = useRef({ x: 0, y: 0, lastX: 0 });

  const layout = () => {
    const w = root.current!.clientWidth, narrow = w < 700;
    ropes.current = HANGING.map((h) => {
      const x = (narrow ? 0.08 + h.at * 0.82 : h.at) * w;
      return Array.from({ length: SEGMENTS }, (_, i) => {
        const y = (i / (SEGMENTS - 1)) * h.len * (narrow ? 0.45 : 1);
        return { x, y, px: x, py: y };
      });
    });
  };

  const paint = () => {
    ropes.current.forEach((rope, i) => {
      const end = rope[SEGMENTS - 1], prev = rope[SEGMENTS - 2];
      const el = tagEls.current[i];
      if (el) {
        const angle = Math.atan2(end.y - prev.y, end.x - prev.x) - Math.PI / 2;
        el.style.transform = `translate(${end.x}px, ${end.y}px) translate(-50%, -14px) rotate(${angle}rad)`;
      }
      svg.current?.children[i]?.setAttribute("points", rope.map((p) => `${p.x},${p.y}`).join(" "));
    });
  };

  useEffect(() => {
    layout();
    paint();
    const onResize = () => { layout(); paint(); };
    addEventListener("resize", onResize);
    return () => removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame(root, (dt, t) => {
    const w = root.current?.clientWidth ?? 1;
    const narrow = w < 700;
    wind.current.x *= 0.92;
    ropes.current.forEach((rope, r) => {
      const seg = (HANGING[r].len * (narrow ? 0.45 : 1)) / (SEGMENTS - 1);
      for (let i = 1; i < SEGMENTS; i++) {
        const p = rope[i], vx = (p.x - p.px) * 0.985, vy = (p.y - p.py) * 0.985;
        p.px = p.x; p.py = p.y;
        const breeze = Math.sin(t * 0.9 + r * 1.7) * 45 + wind.current.x * 130 * (1 - Math.min(1, Math.abs(wind.current.y - p.y) / 360));
        p.x += vx + breeze * dt * dt;
        p.y += vy + 900 * dt * dt;
      }
      if (drag.current?.i === r) { const e = rope[SEGMENTS - 1]; e.x = drag.current.x; e.y = drag.current.y; }
      for (let k = 0; k < 8; k++) {
        for (let i = 1; i < SEGMENTS; i++) {
          const a = rope[i - 1], b = rope[i];
          const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
          if (d <= seg) continue; // string: resists stretching, not slack
          const diff = (d - seg) / d;
          if (i === 1) { b.x -= dx * diff; b.y -= dy * diff; }
          else { a.x += dx * diff / 2; a.y += dy * diff / 2; b.x -= dx * diff / 2; b.y -= dy * diff / 2; }
        }
      }
    });
    paint();
  });

  const localXY = (e: React.PointerEvent) => {
    const r = root.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  return (
    <div ref={root} className="absolute inset-0 overflow-hidden touch-pan-y"
      onPointerMove={(e) => {
        const p = localXY(e);
        wind.current.x = clamp(wind.current.x + (p.x - wind.current.lastX) * 0.02, -5, 5);
        wind.current.y = p.y; wind.current.lastX = p.x;
        if (drag.current) { drag.current.x = p.x; drag.current.y = p.y; }
      }}
      onPointerUp={() => (drag.current = null)} onPointerCancel={() => (drag.current = null)}>
      <svg ref={svg} className="pointer-events-none absolute inset-0 size-full" aria-hidden>
        {HANGING.map((h) => <polyline key={h.name} fill="none" stroke="var(--muted)" strokeWidth="1.25" />)}
      </svg>
      {HANGING.map((h, i) => (
        <div key={h.name} ref={(el) => { tagEls.current[i] = el; }} aria-hidden
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            root.current!.style.touchAction = "none";
            drag.current = { i, ...localXY(e) };
          }}
          onPointerMove={(e) => { if (drag.current?.i === i) { const p = localXY(e); drag.current.x = p.x; drag.current.y = p.y; } }}
          onLostPointerCapture={() => { drag.current = null; root.current!.style.touchAction = ""; }}
          className={`absolute left-0 top-0 flex cursor-grab touch-none select-none flex-col items-start rounded-lg border px-3 pb-2 pt-6 text-sm font-semibold shadow-lg will-change-transform active:cursor-grabbing ${h.bg}`}
          style={{ transform: "translateX(-999px)" }}>
          <span className="absolute left-1/2 top-2 size-2.5 -translate-x-1/2 rounded-full bg-paper ring-1 ring-black/20" />
          <span className="whitespace-nowrap">{h.name}</span>
          <span className="text-xs font-normal opacity-75">{h.source}</span>
        </div>
      ))}
    </div>
  );
}

function SideScroll() {
  const root = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  useScrollProgress(root, (p) => {
    const t = track.current;
    if (t) t.style.transform = `translateX(${-p * Math.max(0, t.scrollWidth - innerWidth)}px)`;
  });
  return (
    <section ref={root} className="h-[320vh]" aria-label="Why TagAWallet">
      <div className="sticky top-0 flex h-dvh items-center overflow-hidden">
        <div ref={track} className="flex items-stretch gap-6 px-[6vw] will-change-transform">
          <div className="flex w-[80vw] shrink-0 items-center md:w-[42vw]">
            <h2 className="text-5xl font-semibold leading-[1.02] tracking-tight md:text-7xl">Tags you can actually trust.</h2>
          </div>
          {POINTS.map((p, i) => (
            <article key={p.title} className={`relative flex min-h-[56vh] w-[80vw] shrink-0 flex-col justify-end rounded-3xl p-8 md:w-[38vw] md:p-10 ${i % 2 ? "bg-accent text-accent-ink" : "border border-line bg-card"}`}>
              <span className="absolute left-8 top-8 size-5 rounded-full bg-paper ring-1 ring-black/10 md:left-10 md:top-10" aria-hidden />
              <h3 className="text-3xl font-semibold leading-tight tracking-tight md:text-4xl">{p.title}</h3>
              <p className={`mt-3 md:text-lg ${i % 2 ? "opacity-85" : "text-muted"}`}>{p.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

const TOKENS = ["Alice", "Treasury", "OTC", "Mine", "Bridge", "Team", "Whale?", "Multisig", "Verified", "Shared", "Private", "Cold", "Grants", "DAO", "Vesting", "Hot wallet"];
const TOKEN_STYLES = ["bg-accent text-accent-ink", "bg-card border border-line", "bg-ink text-paper", "bg-wash border border-line", "bg-good text-paper", "bg-warn text-paper"];

/** Round tags fall in when the footer arrives. They roll, stack, and can be thrown. */
function TagPit({ own }: { own?: { label: string; bg: string; fg: string } }) {
  const [ref, inView] = useInView<HTMLDivElement>();
  const els = useRef<(HTMLDivElement | null)[]>([]);
  const bodies = useRef<{ x: number; y: number; vx: number; vy: number; r: number; a: number }[]>([]);
  const grab = useRef<{ i: number; x: number; y: number } | null>(null);
  const pointer = useRef({ x: -999, y: -999 });

  useEffect(() => {
    if (!inView || !ref.current) return;
    const w = ref.current.clientWidth, base = w < 700 ? 30 : w < 1000 ? 40 : w < 1300 ? 54 : 68;
    bodies.current = TOKENS.map((_, i) => ({ x: ((i * 0.381966) % 1) * (w - 120) + 60, y: -80 - i * 90, vx: 0, vy: 0, r: base + (i % 3) * 8, a: i }));
    bodies.current.forEach((b, i) => {
      const el = els.current[i];
      if (el) { el.style.width = el.style.height = `${b.r * 2}px`; el.style.fontSize = `${Math.max(11, b.r * 0.27)}px`; }
    });
    if (reducedMotion()) {
      // Settled row with no animation.
      const per = Math.floor(w / (base * 2.5));
      bodies.current.forEach((b, i) => { b.x = (i % per + 0.5) * (w / per); b.y = ref.current!.clientHeight - b.r - Math.floor(i / per) * base * 2.3; b.a = 0; });
      bodies.current.forEach((b, i) => { const el = els.current[i]; if (el) el.style.transform = `translate(${b.x - b.r}px, ${b.y - b.r}px)`; });
    }
  }, [inView, ref]);

  useFrame(ref, (dt) => {
    const box = ref.current;
    if (!box || !bodies.current.length) return;
    const W = box.clientWidth, H = box.clientHeight, list = bodies.current;
    const h = dt / 2;
    for (let step = 0; step < 2; step++) {
      for (const b of list) {
        b.vy += 1500 * h;
        const dx = b.x - pointer.current.x, dy = b.y - pointer.current.y, d = Math.hypot(dx, dy) || 1;
        if (d < b.r + 34) { b.vx += (dx / d) * 2200 * h; b.vy += (dy / d) * 2200 * h; }
        b.x += b.vx * h; b.y += b.vy * h;
      }
      if (grab.current) {
        const b = list[grab.current.i];
        b.vx = (grab.current.x - b.x) * 14; b.vy = (grab.current.y - b.y) * 14;
      }
      for (let k = 0; k < 3; k++) {
        for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
          const a = list[i], b = list[j];
          const dx = b.x - a.x, dy = b.y - a.y, min = a.r + b.r, sq = dx * dx + dy * dy;
          if (sq >= min * min || sq === 0) continue;
          const d = Math.sqrt(sq), nx = dx / d, ny = dy / d, over = (min - d) / 2;
          a.x -= nx * over; a.y -= ny * over; b.x += nx * over; b.y += ny * over;
          const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (rel < 0) { const imp = rel * 0.62; a.vx += nx * imp; a.vy += ny * imp; b.vx -= nx * imp; b.vy -= ny * imp; }
        }
        for (const b of list) {
          if (b.y > H - b.r) { b.y = H - b.r; if (b.vy > 0) b.vy *= -0.32; b.vx *= 0.985; }
          if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx) * 0.5; }
          if (b.x > W - b.r) { b.x = W - b.r; b.vx = -Math.abs(b.vx) * 0.5; }
        }
      }
    }
    list.forEach((b, i) => {
      b.a += (b.vx / b.r) * dt * 0.8;
      const el = els.current[i];
      if (el) el.style.transform = `translate(${b.x - b.r}px, ${b.y - b.r}px) rotate(${b.a}rad)`;
    });
  });

  const local = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  return (
    <div ref={ref} className="absolute inset-0 touch-pan-y" aria-hidden
      onPointerMove={(e) => { const p = local(e); if (grab.current) { grab.current.x = p.x; grab.current.y = p.y; } else if (e.pointerType === "mouse") pointer.current = p; }}
      onPointerLeave={() => (pointer.current = { x: -999, y: -999 })}
      onPointerUp={() => (grab.current = null)}>
      {TOKENS.map((token, i) => {
        // The visitor's own tag joins the pile as the first token.
        const t = i === 0 && own ? own.label : token;
        return (
        <div key={i} ref={(el) => { els.current[i] = el; }}
          onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); grab.current = { i, ...local(e) }; pointer.current = { x: -999, y: -999 }; }}
          onLostPointerCapture={() => (grab.current = null)}
          onPointerMove={(e) => { if (grab.current?.i === i) { const p = local(e); grab.current.x = p.x; grab.current.y = p.y; } }}
          className={`absolute left-0 top-0 flex cursor-grab touch-none select-none flex-col items-center justify-center rounded-full font-semibold shadow-md will-change-transform active:cursor-grabbing ${TOKEN_STYLES[i % TOKEN_STYLES.length]}`}
          style={{ transform: "translateY(-9999px)", ...(i === 0 && own ? { background: own.bg, color: own.fg } : {}) }}>
          <span className="mb-0.5 size-[9%] rounded-full bg-paper/80 ring-1 ring-black/15" />
          <span className="max-w-[86%] truncate">{t}</span>
        </div>
        );
      })}
    </div>
  );
}

function TagsHero({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="relative h-dvh min-h-[640px] overflow-hidden">
          <HangingTags />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 mx-auto w-full max-w-6xl px-4 pb-20 md:pb-24">
            <h1 className="rise max-w-3xl text-5xl font-semibold leading-[1] tracking-tight md:text-8xl">Know who&apos;s behind every wallet.</h1>
            <p className="rise mt-5 max-w-xl text-muted md:text-lg" style={{ "--d": "120ms" } as React.CSSProperties}>Privately tag addresses, link socials, group related wallets, and recognize identities wherever you research and trade.</p>
            <div className="rise pointer-events-auto mt-6 w-fit" style={{ "--d": "220ms" } as React.CSSProperties}><Cta signedIn={signedIn} /></div>
          </div>
        </section>
  );
}

type OwnToken = { label: string; bg: string; fg: string };

function TagsFooter({ signedIn, title = "Your turn. Tag something.", own, color }: { signedIn: boolean; title?: string; own?: OwnToken; color?: { bg: string; fg: string } }) {
  return (
    <footer className="relative flex h-[92dvh] min-h-[560px] flex-col overflow-hidden border-t border-line bg-wash" style={color ? { background: color.bg, color: color.fg, borderColor: "transparent" } : undefined}>
      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-wrap items-start justify-between gap-6 px-4 pt-12">
        <div>
          <BrandMark size={72} className={color?.bg === "#EE6A42" ? "brightness-[.3]" : ""} />
          <p className="mt-4 text-4xl font-semibold tracking-tight md:text-6xl">{title}</p>
          <Cta signedIn={signedIn} className={`mt-5 ${color ? "!bg-[#1a1a18] !text-white" : ""}`} />
        </div>
        <FootLinks className={color ? "opacity-75" : "text-muted"} />
      </div>
      <TagPit own={own} />
    </footer>
  );
}

export function TagsLanding({ signedIn }: { signedIn: boolean }) {
  return (
    <>
      <Nav signedIn={signedIn} />
      <main>
        <TagsHero signedIn={signedIn} />
        <SideScroll />
        <section className="mx-auto w-full max-w-5xl px-4 py-32">
          <ScrollWords text={NOT_A_WALLET} className="text-3xl font-semibold leading-tight tracking-tight md:text-5xl" />
        </section>
      </main>
      <TagsFooter signedIn={signedIn} />
    </>
  );
}

export { TagsHero, SideScroll, TagsFooter };
