"use client";
import { useEffect, useRef, useState } from "react";
import { MARK_PARTS } from "@/components/brand-mark-paths";
import { Cta, FootLinks, NOT_A_WALLET, Nav, POINTS, Reveal, ease, fakeAddr, reducedMotion, seg, useFrame, useScrollProgress } from "../shared";

function rng(seed: number) { return () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296; }
const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

const ENTITIES = [
  { name: "Alice, OTC desk", source: "Your private tag", wallets: 6, color: "--ink" },
  { name: "Exchange hot wallets", source: "Verified", wallets: 9, color: "--good" },
  { name: "DAO treasury", source: "Shared by Research", wallets: 7, color: "--warn" },
];
const LOOSE = 34;

type Node = { hx: number; hy: number; cx: number; cy: number; ox: number; oy: number; vx: number; vy: number; e: number; addr: string; phase: number };

function buildNodes() {
  const r = rng(11), nodes: Node[] = [];
  const add = (e: number) => {
    // Homes keep clear of the middle, where the headline sits.
    let hx = 0.5, hy = 0.5;
    while (Math.hypot((hx - 0.5) / 0.36, (hy - 0.48) / 0.34) < 1) { hx = 0.03 + r() * 0.94; hy = 0.1 + r() * 0.85; }
    const a = r() * Math.PI * 2, d = 0.3 + r() * 0.7;
    nodes.push({ hx, hy, cx: Math.cos(a) * d, cy: Math.sin(a) * d, ox: 0, oy: 0, vx: 0, vy: 0, e, addr: fakeAddr(nodes.length + 40), phase: r() * 7 });
  };
  ENTITIES.forEach((en, e) => { for (let i = 0; i < en.wallets; i++) add(e); });
  for (let i = 0; i < LOOSE; i++) add(-1);
  return nodes;
}

function fitCanvas(c: HTMLCanvasElement) {
  const dpr = Math.min(2, devicePixelRatio || 1), w = c.clientWidth, h = c.clientHeight;
  if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
  const ctx = c.getContext("2d")!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h };
}

function GraphStage({ signedIn }: { signedIn: boolean }) {
  const root = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const head = useRef<HTMLDivElement>(null);
  const nodes = useRef<Node[]>(buildNodes());
  const pointer = useRef({ x: -9999, y: -9999 });
  const progress = useRef(0);
  const [chapter, setChapter] = useState(0);

  useScrollProgress(root, (p) => {
    progress.current = p;
    if (head.current) {
      const k = 1 - seg(p, 0, 0.14);
      head.current.style.opacity = String(k);
      head.current.style.transform = `translateY(${-(1 - k) * 60}px)`;
      head.current.style.visibility = k <= 0 ? "hidden" : "visible";
    }
    setChapter(p < 0.18 ? 0 : p < 0.62 ? 1 : 2);
  });

  const draw = (dt: number, t: number) => {
    const c = canvas.current;
    if (!c) return;
    const { ctx, w, h } = fitCanvas(c);
    ctx.clearRect(0, 0, w, h);
    const k = ease(seg(progress.current, 0.14, 0.58));
    const labels = seg(progress.current, 0.52, 0.66);
    const ink = css("--ink"), muted = css("--muted"), accent = css("--accent");
    // Canvas fonts cannot read CSS variables, so resolve the families here.
    const sans = getComputedStyle(c).getPropertyValue("--font-instrument"), mono = getComputedStyle(c).getPropertyValue("--font-jetbrains");
    const wide = w > 760;
    const centers = ENTITIES.map((_, i) => wide ? { x: w * (0.2 + i * 0.3), y: h * 0.47 } : { x: w * 0.5, y: h * (0.17 + i * 0.23) });
    const spread = wide ? Math.min(w * 0.11, h * 0.14) : Math.min(w * 0.2, h * 0.075);
    const px = pointer.current.x, py = pointer.current.y;
    const list = nodes.current;

    // Nearest wallet under the cursor lights up its whole entity.
    let hot = -1, best = 90;
    const pos = list.map((n, i) => {
      const fx = n.hx * w + Math.sin(t * 0.4 + n.phase) * 10;
      const fy = n.hy * h + Math.cos(t * 0.33 + n.phase) * 10;
      const tx = n.e >= 0 ? centers[n.e].x + n.cx * spread : fx;
      const ty = n.e >= 0 ? centers[n.e].y + n.cy * spread : fy;
      const x = fx + (tx - fx) * k + n.ox, y = fy + (ty - fy) * k + n.oy;
      const d = Math.hypot(x - px, y - py);
      if (d < best) { best = d; hot = i; }
      return { x, y };
    });
    const hotE = hot >= 0 ? list[hot].e : -2;

    list.forEach((n, i) => {
      // Cursor attraction on a spring back home.
      const dx = px - pos[i].x, dy = py - pos[i].y, d = Math.hypot(dx, dy);
      const pull = d < 170 ? (1 - d / 170) * 520 : 0;
      n.vx += ((d ? dx / d : 0) * pull - n.ox * 16 - n.vx * 7) * dt;
      n.vy += ((d ? dy / d : 0) * pull - n.oy * 16 - n.vy * 7) * dt;
      n.ox += n.vx * dt; n.oy += n.vy * dt;
    });

    ctx.lineWidth = 1;
    ENTITIES.forEach((en, e) => {
      const members = list.flatMap((n, i) => n.e === e ? [pos[i]] : []);
      const a = Math.max(k * 0.6, hotE === e ? 0.7 : 0);
      if (a <= 0.01) return;
      const col = css(en.color);
      ctx.strokeStyle = col; ctx.globalAlpha = a * 0.55;
      ctx.beginPath();
      const cx = members.reduce((s, m) => s + m.x, 0) / members.length, cy = members.reduce((s, m) => s + m.y, 0) / members.length;
      for (const m of members) { ctx.moveTo(cx, cy); ctx.lineTo(m.x, m.y); }
      ctx.stroke();
      ctx.globalAlpha = 1;
      if (labels > 0 || hotE === e) {
        const la = Math.max(labels, hotE === e ? 1 : 0);
        const lx = hotE === e && labels === 0 ? px : centers[e].x, ly = hotE === e && labels === 0 ? py - 30 : centers[e].y + spread + (wide ? 34 : 20);
        ctx.globalAlpha = la; ctx.textAlign = "center";
        ctx.fillStyle = ink; ctx.font = `600 15px ${sans}, sans-serif`; ctx.fillText(en.name, lx, ly);
        ctx.fillStyle = col; ctx.font = `13px ${sans}, sans-serif`; ctx.fillText(`${en.source} · ${en.wallets} wallets`, lx, ly + 19);
        ctx.globalAlpha = 1;
      }
    });

    list.forEach((n, i) => {
      const { x, y } = pos[i];
      const isHot = n.e === hotE && n.e >= 0;
      ctx.globalAlpha = n.e < 0 ? 0.55 - k * 0.4 : 0.6 + k * 0.4;
      ctx.fillStyle = isHot ? accent : n.e >= 0 && k > 0.05 ? css(ENTITIES[n.e].color) : muted;
      ctx.beginPath(); ctx.arc(x, y, isHot || i === hot ? 5 : n.e >= 0 ? 3.6 : 2.6, 0, 7); ctx.fill();
      if (i === hot) {
        ctx.globalAlpha = 1; ctx.fillStyle = ink; ctx.textAlign = "left"; ctx.font = `12px ${mono}, monospace`;
        ctx.fillText(n.addr, x + 10, y + 4);
      }
      ctx.globalAlpha = 1;
    });
  };

  useFrame(root, draw);
  // Reduced motion: one still frame, redrawn on scroll.
  useEffect(() => {
    if (!reducedMotion()) return;
    const on = () => draw(0, 0);
    on();
    addEventListener("scroll", on, { passive: true });
    return () => removeEventListener("scroll", on);
  });

  const onMove = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    pointer.current = { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const STEPS = ["", "Scattered strings become people, projects and teams.", "One entity, many wallets. Every label shows its source."];

  return (
    <section ref={root} className="h-[340vh]" aria-label="Wallets grouped into entities">
      <div className="sticky top-0 h-dvh overflow-hidden touch-pan-y" onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => (pointer.current = { x: -9999, y: -9999 })}>
        <canvas ref={canvas} className="absolute inset-0 size-full" aria-hidden />
        <div ref={head} className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center pointer-events-none">
          <h1 className="max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tight md:text-7xl">Know who&apos;s behind every wallet.</h1>
          <p className="mt-5 max-w-xl text-muted md:text-lg">Privately tag addresses, link socials, group related wallets, and recognize identities wherever you research and trade.</p>
          <div className="pointer-events-auto mt-7"><Cta signedIn={signedIn} /></div>
          <p className="mt-6 text-xs text-muted">Move over a wallet to see who it belongs with. Scroll to group them all.</p>
        </div>
        {chapter > 0 && <p key={chapter} className="pop absolute inset-x-0 bottom-20 px-6 text-center text-2xl font-semibold tracking-tight md:bottom-16 md:text-4xl">{STEPS[chapter]}</p>}
      </div>
    </section>
  );
}

/** The logo as particles that scatter from the cursor and settle back. */
function ParticleLogo() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const pts = useRef<{ hx: number; hy: number; x: number; y: number; vx: number; vy: number; tone: string }[]>([]);
  const pointer = useRef({ x: -9999, y: -9999 });

  useEffect(() => {
    const off = document.createElement("canvas");
    off.width = 515; off.height = 415;
    const o = off.getContext("2d", { willReadFrequently: true })!;
    const out: typeof pts.current = [];
    const r = rng(5);
    for (const part of MARK_PARTS) {
      o.clearRect(0, 0, 515, 415);
      o.fillStyle = "#000";
      o.fill(new Path2D(part.d), part.evenodd ? "evenodd" : "nonzero");
      const data = o.getImageData(0, 0, 515, 415).data;
      for (let y = 0; y < 415; y += 7) for (let x = 0; x < 515; x += 7) {
        if (data[(y * 515 + x) * 4 + 3] > 128) out.push({ hx: x, hy: y, x: r() * 515, y: r() * 415, vx: 0, vy: 0, tone: part.tone });
      }
    }
    pts.current = out;
  }, []);

  const draw = (dt: number) => {
    const c = canvas.current;
    if (!c) return;
    const { ctx, w, h } = fitCanvas(c);
    ctx.clearRect(0, 0, w, h);
    const s = Math.min(w / 515, h / 415), ox = (w - 515 * s) / 2, oy = (h - 415 * s) / 2;
    const ink = css("--ink");
    const px = (pointer.current.x - ox) / s, py = (pointer.current.y - oy) / s;
    for (const p of pts.current) {
      const dx = p.x - px, dy = p.y - py, d = Math.hypot(dx, dy) || 1;
      const push = d < 70 ? (1 - d / 70) * 5200 : 0;
      p.vx += ((dx / d) * push + (p.hx - p.x) * 30 - p.vx * 8) * dt;
      p.vy += ((dy / d) * push + (p.hy - p.y) * 30 - p.vy * 8) * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      ctx.fillStyle = p.tone === "brand" ? "#EE6A42" : p.tone === "white" ? "#fff" : ink;
      const size = Math.max(1.4, 5.2 * s);
      ctx.fillRect(ox + p.x * s, oy + p.y * s, size, size);
    }
  };
  useFrame(canvas, draw);
  useEffect(() => {
    if (!reducedMotion() || !pts.current.length) return;
    for (const p of pts.current) { p.x = p.hx; p.y = p.hy; }
    draw(0);
  });

  const onMove = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    pointer.current = { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  return <canvas ref={canvas} role="img" aria-label="TagAWallet logo" onPointerMove={onMove} onPointerLeave={() => (pointer.current = { x: -9999, y: -9999 })} className="aspect-[515/415] w-full max-w-md touch-pan-y" />;
}

export function GraphLanding({ signedIn }: { signedIn: boolean }) {
  return (
    <>
      <Nav signedIn={signedIn} />
      <main>
        <GraphStage signedIn={signedIn} />
        <section className="mx-auto grid w-full max-w-6xl gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2">
          {POINTS.map((p) => (
            <div key={p.title} className="bg-card p-6 md:p-8">
              <Reveal>
                <h2 className="text-lg font-semibold">{p.title}</h2>
                <p className="mt-1.5 text-muted">{p.body}</p>
              </Reveal>
            </div>
          ))}
        </section>
        <section className="mx-auto w-full max-w-6xl px-4 py-10 text-center text-sm text-muted">{NOT_A_WALLET}</section>
      </main>
      <footer className="border-t border-line">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-8 px-4 pb-20 pt-12 md:grid-cols-2">
          <div>
            <p className="text-4xl font-semibold leading-[1.05] tracking-tight md:text-5xl">Every wallet belongs to someone.</p>
            <Cta signedIn={signedIn} className="mt-6" />
            <FootLinks className="mt-10 text-muted" />
          </div>
          <div className="flex justify-center"><ParticleLogo /></div>
        </div>
      </footer>
    </>
  );
}
