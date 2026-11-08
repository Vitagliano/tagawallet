"use client";
import { useEffect, useRef, useState } from "react";
import { Cta, ease, reducedMotion, seg, useFrame } from "../shared";
import { PillNav, useSmoothProgress } from "../v3/kit";
import { AMBER, GREEN, INK, NamesColorRun, NamesFooter, ORANGE } from "../v3/names";

/* Names + Compare. The wipe is no longer a slider: you cause it by putting a tag on an address. */

const TAGS = [
  { name: "Alice, OTC desk", bg: ORANGE, fg: INK },
  { name: "DAO treasury", bg: AMBER, fg: INK },
  { name: "Exchange hot wallet", bg: GREEN, fg: "#fff" },
  { name: "My cold storage", bg: INK, fg: "#fff" },
];
const ADDRS = ["0x4c1f…2c15", "0x9e0b…77d1", "0xb71a…40ce", "0x03fd…a98b", "0x72ca…1e06"];
const ROWS: [number, number, string][] = [
  [2, 0, "1,204.5 ETH"], [0, 4, "88.0 ETH"], [1, 2, "310.2 ETH"], [3, 2, "12.0 ETH"], [4, 1, "0.4 ETH"], [2, 3, "540.0 ETH"],
];

type Assigned = Record<number, { tag: number; row: number }>;

function Cell({ addr, row, col, on, hot }: { addr: number; row: number; col: number; on?: { tag: number; row: number }; hot: boolean }) {
  // The change travels outward from the row where the tag landed.
  const delay = on ? Math.abs(row - on.row) * 110 + col * 50 : 0;
  const t = on ? TAGS[on.tag] : null;
  return (
    <span data-addr={addr} data-row={row} className={`relative grid h-9 items-center rounded-md transition-colors duration-150 ${hot ? "bg-accent/15 ring-2 ring-accent" : ""}`}>
      <span className={`addr col-start-1 row-start-1 px-1.5 text-muted transition-opacity duration-200 ${on ? "opacity-0" : ""}`} style={{ transitionDelay: `${delay}ms` }}>{ADDRS[addr]}</span>
      {t && <span className="stamp col-start-1 row-start-1 w-fit max-w-full truncate rounded-l-full rounded-r-md px-2.5 py-1 text-xs font-semibold shadow-md md:text-sm" style={{ background: t.bg, color: t.fg, animationDelay: `${delay}ms` }}>{t.name}</span>}
    </span>
  );
}

function DragStage({ signedIn }: { signedIn: boolean }) {
  const root = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const fill = useRef<HTMLDivElement>(null);
  const fillText = useRef<HTMLDivElement>(null);
  const els = useRef<(HTMLButtonElement | null)[]>([]);
  const body = useRef(TAGS.map((_, i) => ({ x: 0, y: 0, vx: 0, vy: 0, phase: i * 1.7 })));
  const grab = useRef<{ i: number; sx: number; sy: number; px: number; py: number; vx: number; vy: number } | null>(null);
  const flight = useRef<{ i: number; addr: number; t: number; fx: number; fy: number } | null>(null);
  const touched = useRef(false);
  const lastDrop = useRef({ x: 0.5, y: 0.6 });
  const [assigned, setAssigned] = useState<Assigned>({});
  const [used, setUsed] = useState<number[]>([]);
  const [hot, setHot] = useState<number | null>(null);
  const usedRef = useRef(used); usedRef.current = used;
  const assignedRef = useRef(assigned); assignedRef.current = assigned;

  const land = (i: number, addr: number, row: number, x: number, y: number) => {
    setAssigned((a) => ({ ...a, [addr]: { tag: i, row } }));
    setUsed((u) => (u.includes(i) ? u : [...u, i]));
    setHot(null);
    const box = stage.current!.getBoundingClientRect();
    lastDrop.current = { x: (x - box.left) / box.width, y: (y - box.top) / box.height };
    if (reducedMotion()) return;
    // A ring leaves the point of impact, so the change has a visible cause.
    const ring = document.createElement("span");
    ring.setAttribute("aria-hidden", "true");
    ring.style.cssText = `position:absolute;left:${x - box.left}px;top:${y - box.top}px;width:24px;height:24px;margin:-12px;border-radius:50%;border:3px solid ${TAGS[i].bg === INK ? ORANGE : TAGS[i].bg};pointer-events:none;z-index:6`;
    stage.current!.appendChild(ring);
    ring.animate([{ transform: "scale(.4)", opacity: 1 }, { transform: "scale(34)", opacity: 0 }], { duration: 800, easing: "cubic-bezier(.1,.7,.3,1)" }).onfinish = () => ring.remove();
  };

  const cellAt = (x: number, y: number) => document.elementsFromPoint(x, y).map((e) => (e as HTMLElement).closest?.("[data-addr]") as HTMLElement | null).find(Boolean) ?? null;

  useFrame(root, (dt, t) => {
    body.current.forEach((b, i) => {
      const el = els.current[i];
      if (!el || usedRef.current.includes(i)) return;
      const f = flight.current;
      if (f && f.i === i) {
        // Self-demo for visitors who haven't touched anything.
        f.t += dt / 0.9;
        const target = document.querySelector<HTMLElement>(`[data-addr="${f.addr}"]`)!.getBoundingClientRect();
        const box = el.getBoundingClientRect();
        const k = ease(Math.min(1, f.t)), hx = box.left - b.x, hy = box.top - b.y;
        const tx = target.left + 8 - hx, ty = target.top - 2 - hy;
        b.x = f.fx + (tx - f.fx) * k; b.y = f.fy + (ty - f.fy) * k - Math.sin(k * Math.PI) * 60;
        if (f.t >= 1) { land(i, f.addr, Number(document.querySelector<HTMLElement>(`[data-addr="${f.addr}"]`)!.dataset.row), target.left + 40, target.top + 16); flight.current = null; }
      } else if (grab.current?.i !== i) {
        const idleY = Math.sin(t * 1.1 + b.phase) * 4;
        b.vx += (-b.x * 90 - b.vx * 12) * dt;
        b.vy += ((idleY - b.y) * 90 - b.vy * 12) * dt;
        b.x += b.vx * dt; b.y += b.vy * dt;
      }
      const spin = grab.current?.i === i ? Math.max(-14, Math.min(14, grab.current.vx * 0.012)) : b.vx * 0.012;
      el.style.transform = `translate(${b.x}px, ${b.y}px) rotate(${spin}deg) scale(${grab.current?.i === i ? 1.08 : 1})`;
    });
  });

  // If nobody tries it, show them once.
  useEffect(() => {
    if (reducedMotion()) return;
    const id = setTimeout(() => {
      if (touched.current) return;
      flight.current = { i: 0, addr: 0, t: 0, fx: 0, fy: 0 };
    }, 3200);
    return () => clearTimeout(id);
  }, []);

  useSmoothProgress(root, (p) => {
    // Scrolling on finishes the job, so nobody misses the fully named page.
    const done = Math.min(TAGS.length, Math.floor(seg(p, 0.02, 0.42) * (TAGS.length + 1)));
    if (done > usedRef.current.length && !flight.current) {
      const i = TAGS.findIndex((_, k) => !usedRef.current.includes(k));
      const addr = [0, 1, 2, 3, 4].find((a) => !assignedRef.current[a]);
      if (i >= 0 && addr !== undefined) {
        const el = document.querySelector<HTMLElement>(`[data-addr="${addr}"]`);
        if (el) { const r = el.getBoundingClientRect(); land(i, addr, Number(el.dataset.row), r.left + 40, r.top + 16); }
      }
    }
    const k = ease(seg(p, 0.5, 0.96));
    if (fill.current) {
      fill.current.style.clipPath = `circle(${k * 150}% at ${lastDrop.current.x * 100}% ${lastDrop.current.y * 100}%)`;
      fill.current.style.visibility = k > 0 ? "visible" : "hidden";
    }
    if (fillText.current) fillText.current.style.opacity = String(seg(p, 0.72, 0.84));
  });

  const all = used.length === TAGS.length;
  return (
    <section ref={root} className="h-[260vh]">
      <div ref={stage} className="sticky top-0 flex h-dvh select-none flex-col justify-center overflow-hidden px-4 pt-16">
        <div className="mx-auto w-full max-w-6xl">
          <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
            <h1 className="rise max-w-3xl text-[clamp(2.4rem,5.6vw,5.25rem)] font-semibold leading-[1] tracking-[-0.03em]">Know who&apos;s behind every wallet.</h1>
            <div className="rise" style={{ "--d": "140ms" } as React.CSSProperties}><Cta signedIn={signedIn} /></div>
          </div>
          <p aria-live="polite" className="mt-4 font-medium md:mt-6 md:text-lg">
            {all ? <span className="text-accent">That&apos;s the product. It works like this on every site you enable.</span> : used.length ? `${TAGS.length - used.length} left. Try another.` : "Grab a tag and drop it on any address."}
          </p>
          <div className="relative z-10 mt-3 flex min-h-11 flex-wrap gap-2 md:gap-3">
            {TAGS.map((t, i) => (
              <button key={t.name} type="button" ref={(el) => { els.current[i] = el; }} disabled={used.includes(i)}
                aria-label={`${t.name}. Tag the next untagged address.`}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" && e.key !== " ") return;
                  e.preventDefault();
                  const addr = [0, 1, 2, 3, 4].find((a) => !assigned[a]);
                  const el = addr !== undefined ? document.querySelector<HTMLElement>(`[data-addr="${addr}"]`) : null;
                  if (el) { const r = el.getBoundingClientRect(); land(i, addr!, Number(el.dataset.row), r.left + 40, r.top + 16); }
                }}
                onPointerDown={(e) => {
                  touched.current = true;
                  if (flight.current?.i === i) flight.current = null;
                  e.currentTarget.setPointerCapture(e.pointerId);
                  grab.current = { i, sx: e.clientX - body.current[i].x, sy: e.clientY - body.current[i].y, px: e.clientX, py: e.clientY, vx: 0, vy: 0 };
                }}
                onPointerMove={(e) => {
                  const g = grab.current;
                  if (!g || g.i !== i) return;
                  g.vx = g.vx * 0.7 + (e.clientX - g.px) * 12 * 0.3; g.vy = g.vy * 0.7 + (e.clientY - g.py) * 12 * 0.3;
                  g.px = e.clientX; g.py = e.clientY;
                  body.current[i].x = e.clientX - g.sx; body.current[i].y = e.clientY - g.sy;
                  const c = cellAt(e.clientX, e.clientY);
                  setHot(c ? Number(c.dataset.addr) : null);
                }}
                onPointerUp={(e) => {
                  const g = grab.current;
                  if (!g || g.i !== i) return;
                  grab.current = null;
                  // Forgiving aim: a quick flick counts where it was heading.
                  const c = cellAt(e.clientX, e.clientY) ?? cellAt(e.clientX + g.vx * 0.12, e.clientY + g.vy * 0.12);
                  setHot(null);
                  if (c) land(i, Number(c.dataset.addr), Number(c.dataset.row), e.clientX, e.clientY);
                  else { body.current[i].vx = g.vx * 0.5; body.current[i].vy = g.vy * 0.5; }
                }}
                className={`flex touch-none cursor-grab items-center gap-2 whitespace-nowrap rounded-l-full rounded-r-xl py-2 pl-2.5 pr-3.5 text-sm font-semibold shadow-[0_10px_24px_-10px_rgba(0,0,0,.45)] transition-opacity duration-200 active:cursor-grabbing md:text-lg ${used.includes(i) ? "pointer-events-none opacity-0" : ""}`}
                style={{ background: t.bg, color: t.fg, border: t.bg === INK ? "1px solid rgba(255,255,255,.2)" : undefined, zIndex: 20 }}>
                <span className="size-2.5 rounded-full bg-paper ring-1 ring-black/20" aria-hidden />{t.name}
              </button>
            ))}
          </div>
          <div className="mt-4 overflow-hidden rounded-xl border border-line bg-card text-sm shadow-2xl">
            <div className="flex items-center gap-2 border-b border-line px-4 py-2.5 text-xs text-muted">
              <span className="size-2.5 rounded-full bg-line" /><span className="size-2.5 rounded-full bg-line" /><span className="size-2.5 rounded-full bg-line" />
              <span className="ml-2">an explorer you already use</span>
            </div>
            <div className="grid grid-cols-2 gap-x-3 border-b border-line px-4 py-2 text-xs font-medium text-muted md:grid-cols-[1.5fr_1.5fr_.7fr]"><span>From</span><span>To</span><span className="hidden md:block">Value</span></div>
            {ROWS.map(([from, to, value], r) => (
              <div key={r} className="grid grid-cols-2 items-center gap-x-3 border-b border-line px-4 py-1 last:border-0 md:grid-cols-[1.5fr_1.5fr_.7fr] md:py-1.5">
                <Cell addr={from} row={r} col={0} on={assigned[from]} hot={hot === from} />
                <Cell addr={to} row={r} col={1} on={assigned[to]} hot={hot === to} />
                <span className="hidden text-xs text-muted md:block">{value}</span>
              </div>
            ))}
          </div>
        </div>
        <div ref={fill} aria-hidden className="pointer-events-none absolute inset-0 z-30 grid place-items-center px-5 text-center" style={{ background: ORANGE, color: INK, clipPath: "circle(0% at 50% 60%)", visibility: "hidden" }}>
          <div ref={fillText} style={{ opacity: 0 }} className="text-[clamp(2.75rem,8vw,7.5rem)] font-semibold leading-[1] tracking-[-0.035em]">That&apos;s all it takes.</div>
        </div>
      </div>
    </section>
  );
}

export function StampLanding({ signedIn }: { signedIn: boolean }) {
  return (
    <>
      <PillNav signedIn={signedIn} />
      <main>
        <DragStage signedIn={signedIn} />
        <NamesColorRun />
      </main>
      <NamesFooter signedIn={signedIn} />
    </>
  );
}
