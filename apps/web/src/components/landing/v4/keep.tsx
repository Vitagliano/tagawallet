"use client";
import { useEffect, useRef, useState } from "react";
import { clamp, ease, reducedMotion, seg, useFrame } from "../shared";
import { TagsFooter } from "../v1/tags";
import { PillNav, useSmoothProgress } from "../v3/kit";
import { Identicon, Maker, Scene, TRAVEL, TagChip, YoursAudience, useTagMaker, type Tag } from "../v3/yours";

/* Yours + Tags. There is one tag on one string for the whole page. It never gets re-drawn somewhere else. */

const SEGMENTS = 11;
type P = { x: number; y: number; px: number; py: number };

function StringedTag({ tag, jiggle }: { tag: Tag; jiggle: number }) {
  const layer = useRef<HTMLDivElement>(null);
  const line = useRef<SVGPathElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const chip = useRef<HTMLDivElement>(null);
  const rope = useRef<P[]>([]);
  const drag = useRef<{ dx: number; dy: number; x: number; y: number } | null>(null);
  const attached = useRef(0);

  useEffect(() => {
    const end = rope.current[SEGMENTS - 1];
    if (end && jiggle > 0) end.px = end.x - (jiggle % 2 ? 8 : -8);
  }, [jiggle]);

  const frame = (dt: number) => {
    const H = innerHeight;
    const home = document.querySelector("[data-rope-home]")?.getBoundingClientRect();
    if (!home) return;
    const travel = document.querySelector("[data-travel]") as HTMLElement | null;
    const tr = travel?.getBoundingClientRect();
    const audience = document.querySelector("[data-rope-slot]")?.getBoundingClientRect();
    const footer = document.querySelector("footer")?.getBoundingClientRect();

    // Where the string should be clipped right now, if anywhere.
    let target: { x: number; y: number } | null = null;
    let want = 0;
    if (tr) {
      want = ease(clamp((H * 0.95 - tr.top) / (H * 0.6)));
      const slotOf = () => {
        const a = (travel as HTMLElement).dataset.active ?? "0", b = (travel as HTMLElement).dataset.next ?? a, k = Number((travel as HTMLElement).dataset.k ?? 0);
        const ra = travel!.querySelector(`[data-scene="${a}"] [data-slot]`)?.getBoundingClientRect(), rb = travel!.querySelector(`[data-scene="${b}"] [data-slot]`)?.getBoundingClientRect();
        if (!ra || !rb) return null;
        return { x: ra.left + (rb.left - ra.left) * k + 14, y: ra.top + (rb.top - ra.top) * k };
      };
      if (tr.bottom > H * 0.35) target = slotOf();
      else if (audience && audience.top < H * 0.9) target = { x: audience.left + 18, y: audience.top };
      else if (audience) target = { x: innerWidth / 2, y: H * 0.34 };
      if (tr.bottom <= H * 0.35) want = 1;
    }
    attached.current = want;
    const k = reducedMotion() ? (want > 0.5 ? 1 : 0) : want;
    const released = footer ? seg(H * 0.72 - footer.top, 0, H * 0.32) : 0;

    if (!rope.current.length) {
      const x = home.left + home.width / 2;
      rope.current = Array.from({ length: SEGMENTS }, (_, i) => { const u = i / (SEGMENTS - 1), px = x + u * 130, py = home.top - 30 + u * 220; return { x: px, y: py, px, py }; });
    }
    const pts = rope.current;
    // The top of the string travels with the page in the hero, then rides along the top of the screen.
    const ax = home.left + home.width / 2 + ((target?.x ?? home.left + home.width / 2) - (home.left + home.width / 2)) * k;
    const ay = home.top - 30 + (-20 - (home.top - 30)) * k;
    const rest = Math.min(home.height * 0.45, 260);
    const span = target ? Math.hypot(target.x - ax, target.y - ay) : rest;
    // Only pays out extra string once the tag is actually heading for a clip point.
    const step = (rest + Math.max(0, span - rest) * k) / (SEGMENTS - 1);
    const g = 1500 * dt * dt;
    for (let i = 1; i < SEGMENTS; i++) {
      const p = pts[i], vx = (p.x - p.px) * 0.987, vy = (p.y - p.py) * 0.987;
      p.px = p.x; p.py = p.y; p.x += vx; p.y += vy + g * (i === SEGMENTS - 1 ? 2.2 : 1);
    }
    const end = pts[SEGMENTS - 1];
    if (drag.current && k < 0.05) { end.x = drag.current.x - drag.current.dx; end.y = drag.current.y - drag.current.dy; }
    if (target && k > 0) { end.x += (target.x - end.x) * Math.min(1, k * 0.32); end.y += (target.y - end.y) * Math.min(1, k * 0.32); }
    pts[0].x = ax; pts[0].y = ay;
    for (let it = 0; it < 14; it++) for (let i = 1; i < SEGMENTS; i++) {
      const a = pts[i - 1], b = pts[i], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
      if (d <= step) continue;
      const f = (d - step) / d;
      if (i === 1) { b.x -= dx * f; b.y -= dy * f; }
      else { a.x += dx * f / 2; a.y += dy * f / 2; b.x -= dx * f / 2; b.y -= dy * f / 2; }
    }
    let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for (let i = 1; i < SEGMENTS - 1; i++) d += ` Q ${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)} ${((pts[i].x + pts[i + 1].x) / 2).toFixed(1)} ${((pts[i].y + pts[i + 1].y) / 2).toFixed(1)}`;
    d += ` L ${end.x.toFixed(1)} ${end.y.toFixed(1)}`;
    line.current?.setAttribute("d", d);
    line.current?.setAttribute("stroke-width", String(16 - k * 12.5));
    const prev = pts[SEGMENTS - 3], angle = clamp(Math.atan2(end.y - prev.y, end.x - prev.x) - Math.PI / 2, -0.8, 0.8);
    if (card.current) {
      const o = 1 - seg(k, 0.25, 0.7);
      card.current.style.opacity = String(o);
      card.current.style.pointerEvents = o > 0.9 ? "auto" : "none";
      card.current.style.transform = `translate(${end.x}px, ${end.y}px) translate(-50%, -14px) rotate(${angle}rad) scale(${1 - k * 0.55})`;
    }
    if (chip.current) {
      // At the "who gets to see" headline the tag becomes the headline's own highlight.
      const merged = audience ? seg(H * 0.8 - audience.top, 0, H * 0.25) : 0;
      chip.current.style.opacity = String(seg(k, 0.3, 0.7) * (1 - merged));
      chip.current.style.transform = `translate(${end.x - 14}px, ${end.y}px) rotate(${k >= 1 && !target ? angle : 0}rad)`;
    }
    if (layer.current) {
      layer.current.style.transform = `translateY(${released * released * 120}vh)`;
      layer.current.style.opacity = String(1 - seg(released, 0.5, 1));
    }
  };

  useFrame(layer, frame);
  useEffect(() => {
    if (!reducedMotion()) return;
    const on = () => { for (let i = 0; i < 8; i++) frame(0.016); };
    on();
    addEventListener("scroll", on, { passive: true });
    return () => removeEventListener("scroll", on);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const c = tag.swatch;
  return (
    <div ref={layer} className="pointer-events-none fixed inset-0 z-30" onPointerMove={(e) => { if (drag.current) { drag.current.x = e.clientX; drag.current.y = e.clientY; } }}>
      <svg className="absolute inset-0 size-full overflow-visible" aria-hidden><path ref={line} fill="none" stroke="var(--ink)" strokeWidth="16" strokeLinecap="round" /></svg>
      <div ref={card}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); const end = rope.current[SEGMENTS - 1]; drag.current = { dx: e.clientX - end.x, dy: e.clientY - end.y, x: e.clientX, y: e.clientY }; }}
        onPointerMove={(e) => { if (drag.current) { drag.current.x = e.clientX; drag.current.y = e.clientY; } }}
        onLostPointerCapture={() => { drag.current = null; }}
        className="absolute left-0 top-0 w-[230px] origin-top cursor-grab touch-none select-none active:cursor-grabbing md:w-[300px]" style={{ transform: "translate(-999px,0)" }}>
        <div className="flex aspect-[3/4.2] flex-col overflow-hidden rounded-[1.6rem] p-5 shadow-[0_34px_70px_-22px_rgba(0,0,0,.55)] transition-colors duration-500 md:p-7" style={{ background: c.bg, color: c.fg, border: c.id === "cream" ? "1px solid #dfdbcf" : undefined }}>
          <span className="mx-auto h-3 w-12 shrink-0 rounded-full bg-black/25" aria-hidden />
          <Identicon seed={tag.address || "x"} fg={c.fg} className="mt-5 size-16 md:size-24" />
          <p key={tag.name} className="pop mt-auto line-clamp-3 break-words text-3xl font-semibold leading-[1.02] tracking-tight md:text-[2.5rem]">{tag.name || "Name it"}</p>
          <p className="font-mono mt-3 truncate text-sm">{tag.short}</p>
          <p className="mt-1 flex justify-between gap-2 text-xs" style={{ color: c.sub }}><span className="truncate">{tag.valid ? tag.chain : "Not an address yet"}</span><span className="shrink-0">Only you</span></p>
        </div>
      </div>
      <div ref={chip} className="absolute left-0 top-0" style={{ opacity: 0 }} aria-hidden><TagChip tag={tag} /></div>
    </div>
  );
}

function Stops({ tag }: { tag: Tag }) {
  const root = useRef<HTMLElement>(null);
  const field = useRef<HTMLDivElement>(null);
  const scenes = useRef<(HTMLDivElement | null)[]>([]);
  const [step, setStep] = useState(0);
  useSmoothProgress(root, (p) => {
    if (field.current) { const g = ease(seg(p, 0, 0.08)); field.current.style.transform = `scale(${0.9 + g * 0.1})`; field.current.style.borderRadius = `${(1 - g) * 48}px`; }
    const n = TRAVEL.length, from = Math.min(n - 1, Math.floor(p * n)), local = p * n - from;
    const k = from === n - 1 ? 0 : ease(seg(local, 0.6, 1)), to = Math.min(n - 1, from + 1);
    setStep(k > 0.5 ? to : from);
    scenes.current.forEach((el, i) => { if (el) el.style.opacity = String(i === from ? 1 - seg(k, 0, 0.55) : i === to ? seg(k, 0.45, 1) : 0); });
    if (root.current) { root.current.dataset.active = String(from); root.current.dataset.next = String(to); root.current.dataset.k = String(k); }
  });
  return (
    <section ref={root} data-travel className="h-[440vh]" aria-label="Your tag clipped onto each site">
      <div className="sticky top-0 flex h-dvh flex-col items-center justify-center gap-5 overflow-hidden px-4 pt-16 md:gap-7" style={{ color: tag.swatch.fg }}>
        <div ref={field} aria-hidden className="absolute inset-0 transition-colors duration-500" style={{ background: tag.swatch.bg, transform: "scale(.9)", borderRadius: 48 }} />
        <div key={step} className="pop relative text-center">
          <h2 className="text-3xl font-semibold tracking-tight md:text-6xl">{TRAVEL[step].title}</h2>
          <p className="mx-auto mt-2 max-w-lg opacity-75 md:text-lg">{TRAVEL[step].body}</p>
        </div>
        <div className="relative w-full max-w-4xl overflow-hidden rounded-2xl border border-line bg-card text-ink shadow-[0_40px_90px_-30px_rgba(0,0,0,.6)]">
          <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
            <span className="size-2.5 rounded-full bg-line" /><span className="size-2.5 rounded-full bg-line" /><span className="size-2.5 rounded-full bg-line" />
            <div className="ml-2 flex gap-1 text-xs">{TRAVEL.map((t, i) => <span key={t.id} className={`rounded-md px-2 py-1 font-medium transition-colors duration-300 ${step === i ? "bg-wash text-ink" : "text-muted"}`}>{t.id}</span>)}</div>
          </div>
          <div className="relative h-[310px] md:h-[340px]">
            {TRAVEL.map((t, i) => <div key={t.id} data-scene={i} ref={(el) => { scenes.current[i] = el; }} className="absolute inset-0" style={{ opacity: i === 0 ? 1 : 0 }}><Scene i={i} tag={tag} /></div>)}
          </div>
        </div>
      </div>
    </section>
  );
}

export function KeepLanding({ signedIn }: { signedIn: boolean }) {
  const m = useTagMaker();
  const { tag, address, setAddress, name, setName, swatch, setSwatch, jiggle, poke } = m;
  const short = tag.name.length > 14 ? `${tag.name.slice(0, 13)}…` : tag.name || "Yours";
  return (
    <>
      <PillNav signedIn={signedIn} />
      <StringedTag tag={tag} jiggle={jiggle} />
      <main>
        <section className="mx-auto grid min-h-dvh w-full max-w-6xl items-center gap-2 px-5 pb-16 pt-24 md:grid-cols-[1.05fr_1fr] md:gap-8 md:pt-16">
          <div className="order-2 md:order-1">
            <h1 className="rise text-[clamp(2.75rem,6.4vw,5.75rem)] font-semibold leading-[.98] tracking-[-0.035em]">Know who&apos;s behind every wallet.</h1>
            <p className="rise mt-4 max-w-lg text-muted md:text-lg" style={{ "--d": "100ms" } as React.CSSProperties}>Make a tag, then scroll. It stays with you.</p>
            <div className="rise" style={{ "--d": "200ms" } as React.CSSProperties}>
              <Maker address={address} setAddress={setAddress} name={name} setName={setName} swatch={swatch} setSwatch={setSwatch} tag={tag} poke={poke} signedIn={signedIn} />
            </div>
          </div>
          <div data-rope-home className="order-1 h-[500px] md:order-2 md:h-[640px]" aria-hidden />
        </section>
        <Stops tag={tag} />
        <YoursAudience tag={tag} />
      </main>
      <TagsFooter signedIn={signedIn} title={`Keep “${tag.name || "this one"}”.`} own={{ label: short, bg: tag.swatch.bg, fg: tag.swatch.fg }} color={{ bg: "#efece2", fg: "#1a1a18" }} />
    </>
  );
}
