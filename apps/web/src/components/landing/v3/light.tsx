"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BrandMark } from "@/components/brand-mark";
import { Chip, POINTS, ScrollWords, NOT_A_WALLET, clamp, ease, reducedMotion, seg, useFrame, useInView, type Tone } from "../shared";
import { PillNav, useSmoothProgress } from "./kit";

/* ---------- The eclipse: one shader behind the whole page ---------- */

const FRAG = `precision mediump float;
uniform vec2 u_r; uniform float u_t; uniform vec2 u_c; uniform float u_R; uniform float u_pow; uniform float u_ang; uniform float u_hot;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*n(p);p=p*2.03+7.1;a*=.5;}return v;}
void main(){
  vec2 uv=(gl_FragCoord.xy-.5*u_r)/u_r.y;
  vec2 p=uv-u_c; float l=length(p); float a=atan(p.y,p.x); float d=l-u_R;
  vec2 dir=vec2(cos(a),sin(a));
  float rays=fbm(dir*2.6+vec2(u_t*.035,-u_t*.028)+d*.5);
  float fine=fbm(dir*9.-u_t*.05+d*1.2);
  float aim=pow(.5+.5*cos(a-u_ang),3.);
  float hot=mix(.5,1.7,mix(.42,aim,u_hot));
  float rim=exp(-abs(d)*(d>0.?30.:90.))*1.25;
  float halo=exp(-max(d,0.)*(3.2-rays*1.5))*(.16+1.1*rays*fine);
  float inside=smoothstep(-.006,.004,d);
  float v=(rim+halo*inside)*hot*u_pow;
  vec3 c=vec3(.03,.026,.023);
  c+=vec3(.62,.17,.06)*smoothstep(.02,.5,v);
  c+=vec3(.5,.2,.06)*smoothstep(.3,.95,v);
  c+=vec3(.42,.36,.3)*smoothstep(.8,1.8,v);
  c+=(h(gl_FragCoord.xy+fract(u_t)*91.)-.5)*.03;
  gl_FragColor=vec4(c,1.);
}`;

type Key = { y: number; cy: number; R: number; pow: number };

function useEclipse(canvas: React.RefObject<HTMLCanvasElement | null>, keys: () => Key[]) {
  const getKeys = useRef(keys);
  useEffect(() => { getKeys.current = keys; });
  useEffect(() => {
    const c = canvas.current;
    const gl = c?.getContext("webgl", { antialias: false, alpha: false, powerPreference: "low-power" });
    // Without WebGL the CSS gradient on the wrapper stands in.
    if (!c || !gl) return;
    const sh = (type: number, src: string) => { const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, "attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}"));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(gl.getAttribLocation(prog, "a"), 2, gl.FLOAT, false, 0, 0);
    const u = (n: string) => gl.getUniformLocation(prog, n);
    const U = { r: u("u_r"), t: u("u_t"), c: u("u_c"), R: u("u_R"), pow: u("u_pow"), ang: u("u_ang"), hot: u("u_hot") };

    const s = { cy: -1.32, R: 1.1, pow: 1, ang: Math.PI / 2, hot: 0, tAng: Math.PI / 2, tHot: 0 };
    const onMove = (e: PointerEvent) => {
      // Aim the brightest part of the rim at the cursor, measured from the disc's centre.
      const W = innerWidth, H = innerHeight;
      const ux = (e.clientX - W / 2) / H, uy = (H / 2 - e.clientY) / H;
      s.tAng = Math.atan2(uy - s.cy, ux);
      s.tHot = 1;
    };
    addEventListener("pointermove", onMove, { passive: true });

    let raf = 0, last = performance.now(), t = 11;
    const sample = () => {
      const k = getKeys.current(), y = scrollY;
      if (!k.length) return k[0];
      if (y <= k[0].y) return k[0];
      for (let i = 1; i < k.length; i++) if (y < k[i].y) {
        const e = ease((y - k[i - 1].y) / Math.max(1, k[i].y - k[i - 1].y));
        const m = (a: number, b: number) => a + (b - a) * e;
        return { y, cy: m(k[i - 1].cy, k[i].cy), R: m(k[i - 1].R, k[i].R), pow: m(k[i - 1].pow, k[i].pow) };
      }
      return k[k.length - 1];
    };
    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
      const scale = Math.min(0.75, 1200 / Math.max(innerWidth, 1));
      const w = Math.round(c.clientWidth * scale), h = Math.round(c.clientHeight * scale);
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; gl.viewport(0, 0, w, h); }
      const target = sample();
      if (target) {
        const k = 1 - Math.exp(-dt * 7);
        s.cy += (target.cy - s.cy) * k; s.R += (target.R - s.R) * k; s.pow += (target.pow - s.pow) * k;
      }
      // Shortest way round the circle, so the light never spins the long way.
      const da = Math.atan2(Math.sin(s.tAng - s.ang), Math.cos(s.tAng - s.ang));
      s.ang += da * (1 - Math.exp(-dt * 5));
      s.hot += (s.tHot - s.hot) * (1 - Math.exp(-dt * 2));
      gl.uniform2f(U.r, w, h); gl.uniform1f(U.t, t); gl.uniform2f(U.c, 0, s.cy); gl.uniform1f(U.R, s.R);
      gl.uniform1f(U.pow, s.pow); gl.uniform1f(U.ang, s.ang); gl.uniform1f(U.hot, s.hot);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!reducedMotion()) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    const still = () => { const v = sample(); if (v) { s.cy = v.cy; s.R = v.R; s.pow = v.pow; } draw(performance.now()); };
    if (reducedMotion()) addEventListener("scroll", still, { passive: true });
    return () => { cancelAnimationFrame(raf); removeEventListener("pointermove", onMove); removeEventListener("scroll", still); };
  }, [canvas]);
}

/* ---------- Hero: addresses crawl along the edge of the light ---------- */

const ARC_TEXT = "Alice, OTC desk   0x4c1f…2c15   DAO treasury   0x9e0b…77d1   Exchange hot wallet   0xb71a…40ce   My cold storage   0x03fd…a98b   Bob, market maker   0x72ca…1e06   Grants multisig   0xd5e2…9f30   ";

function ArcTicker() {
  const svg = useRef<SVGSVGElement>(null);
  const path = useRef<SVGPathElement>(null);
  const text = useRef<SVGTextPathElement>(null);
  const [size, setSize] = useState({ w: 1440, h: 900 });
  useEffect(() => {
    const on = () => setSize({ w: innerWidth, h: innerHeight });
    on();
    addEventListener("resize", on);
    return () => removeEventListener("resize", on);
  }, []);
  useFrame(svg, (_, t) => text.current?.setAttribute("startOffset", `${-((t * 16) % 1500)}`));
  // Same circle the shader draws, in pixels, a little outside the rim.
  const { w, h } = size;
  const R = 1.1 * h + 16, cx = w / 2, cy = h / 2 + 1.32 * h;
  const a = Math.min(1.2, Math.asin(Math.min(1, (w * 0.62) / R)));
  const f = (v: number) => v.toFixed(1);
  const d = `M ${f(cx - Math.sin(a) * R)} ${f(cy - Math.cos(a) * R)} A ${f(R)} ${f(R)} 0 0 1 ${f(cx + Math.sin(a) * R)} ${f(cy - Math.cos(a) * R)}`;
  return (
    <svg ref={svg} aria-hidden className="pointer-events-none absolute inset-0 size-full" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <path ref={path} id="lp-arc" d={d} fill="none" />
      <text className="font-mono" fontSize={w < 720 ? 11 : 13} fill="#ffd9a8" fillOpacity=".75" letterSpacing=".04em" style={{ whiteSpace: "pre" }}>
        <textPath ref={text} href="#lp-arc">{ARC_TEXT.repeat(5)}</textPath>
      </text>
    </svg>
  );
}

function Hero({ signedIn, heroRef }: { signedIn: boolean; heroRef: React.RefObject<HTMLElement | null> }) {
  const inner = useRef<HTMLDivElement>(null);
  useSmoothProgress(heroRef, (p) => {
    if (!inner.current) return;
    inner.current.style.transform = `translateY(${-p * 90}px)`;
    inner.current.style.opacity = String(1 - seg(p, 0.35, 0.8));
  }, 9, "exit");
  return (
    <section ref={heroRef} className="relative flex h-dvh min-h-[600px] flex-col items-center overflow-hidden px-5 pt-[17dvh] text-center">
      <ArcTicker />
      <div ref={inner} className="relative z-10 flex flex-col items-center will-change-transform">
        <h1 className="text-[clamp(2.9rem,7.6vw,7.5rem)] font-semibold leading-[.98] tracking-[-0.035em]" style={{ textShadow: "0 0 80px rgba(238,106,66,.25)" }}>
          <span className="rise block">Know who&apos;s behind</span>
          <span className="rise block" style={{ "--d": "100ms" } as React.CSSProperties}>every wallet.</span>
        </h1>
        <p className="rise mt-6 max-w-xl text-lg text-[#c9c5b9]" style={{ "--d": "220ms" } as React.CSSProperties}>Privately tag addresses, link socials, group related wallets, and recognize identities wherever you research and trade.</p>
        <div className="rise mt-7" style={{ "--d": "320ms" } as React.CSSProperties}>
          <Link href={signedIn ? "/dashboard" : "/signup"} className="inline-flex items-center gap-2 rounded-full bg-[#fff4e6] px-6 py-3.5 text-lg font-medium text-[#1a0d07] shadow-[0_0_44px_-6px_#EE6A42] transition-[transform,box-shadow] duration-300 hover:scale-[1.04] hover:shadow-[0_0_70px_-4px_#EE6A42] active:scale-95">
            {signedIn ? "Open dashboard" : "Start tagging, it's free"}<span className="cta-arrow" aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ---------- Orbit: everyone you've looked up, circling one mark ---------- */

type Source = "private" | "shared" | "verified";
type Node = { name: string; short: string; source: Source; label: string; wallets: number; tone: Tone };
const RINGS: Node[][] = [
  [
    { name: "Alice, OTC desk", short: "AL", source: "private", label: "Your private tag", wallets: 4, tone: "mine" },
    { name: "My cold storage", short: "ME", source: "private", label: "Your private tag", wallets: 2, tone: "mine" },
    { name: "Bob, market maker", short: "BO", source: "private", label: "Your private tag", wallets: 3, tone: "mine" },
  ],
  [
    { name: "DAO treasury", short: "DT", source: "shared", label: "Shared by Research", wallets: 7, tone: "warn" },
    { name: "Team vesting", short: "TV", source: "shared", label: "Shared by Research", wallets: 5, tone: "warn" },
    { name: "Airdrop farmer?", short: "AF", source: "private", label: "Your private tag", wallets: 12, tone: "mine" },
    { name: "Grants multisig", short: "GM", source: "shared", label: "Shared by Ops", wallets: 1, tone: "warn" },
  ],
  [
    { name: "Exchange hot wallets", short: "EX", source: "verified", label: "Verified", wallets: 9, tone: "good" },
    { name: "Bridge contract", short: "BR", source: "verified", label: "Verified", wallets: 2, tone: "good" },
    { name: "Protocol treasury", short: "PT", source: "verified", label: "Verified", wallets: 6, tone: "good" },
    { name: "Whale, probably", short: "WH", source: "private", label: "Your private tag", wallets: 1, tone: "mine" },
    { name: "Fund desk", short: "FD", source: "shared", label: "Shared by Research", wallets: 3, tone: "warn" },
  ],
];
const RADII = [24, 33, 42]; // vmin
const FILTERS: { id: Source | "all"; label: string; line: string }[] = [
  { id: "all", label: "Everyone", line: "Every wallet you care about, in one place." },
  { id: "private", label: "Private", line: "Your notes. Nobody else can see them." },
  { id: "shared", label: "Shared", line: "Your team's research, only for your team." },
  { id: "verified", label: "Verified", line: "Public profiles that were actually checked." },
];
const NODE_COLOR: Record<Source, string> = { private: "#efece3", shared: "#dbab45", verified: "#55c58d" };

function Orbit({ orbitRef }: { orbitRef: React.RefObject<HTMLElement | null> }) {
  const stage = useRef<HTMLDivElement>(null);
  const copy = useRef<HTMLDivElement>(null);
  const center = useRef<HTMLDivElement>(null);
  const ringEls = useRef<(SVGCircleElement | null)[]>([]);
  const nodeEls = useRef<(HTMLButtonElement | null)[][]>(RINGS.map(() => []));
  const prog = useRef(0);
  const spin = useRef(0);
  const [active, setActive] = useState<Node | null>(null);
  const [chosen, setChosen] = useState<Source | "all" | null>(null);
  const [auto, setAuto] = useState<Source | "all">("all");
  const filter = chosen ?? auto;
  const line = FILTERS.find((f) => f.id === filter)!.line;

  const place = () => {
    const vmin = Math.min(innerWidth, innerHeight) / 100, p = prog.current;
    const inK = ease(seg(p, 0, 0.16)), out = ease(seg(p, 0.86, 1));
    RINGS.forEach((ring, r) => {
      const dir = r % 2 ? -1 : 1, radius = RADII[r] * vmin * (0.55 + inK * 0.45) * (1 + out * 0.9);
      ring.forEach((_, i) => {
        const el = nodeEls.current[r][i];
        if (!el) return;
        const a = (i / ring.length) * Math.PI * 2 + r * 0.7 + dir * (spin.current * (0.075 - r * 0.012) + p * 2.2);
        const pop = ease(seg(p, 0.02 + (r * 0.03) + i * 0.012, 0.14 + r * 0.03 + i * 0.012));
        el.style.transform = `translate(${Math.cos(a) * radius}px, ${Math.sin(a) * radius}px) translate(-50%, -50%) scale(${pop * (1 - out * 0.5)})`;
        el.style.pointerEvents = pop > 0.9 && out === 0 ? "" : "none";
      });
      const c = ringEls.current[r];
      if (c) { c.setAttribute("r", String(radius)); c.style.opacity = String(inK * (1 - out)); }
    });
    if (copy.current) copy.current.style.opacity = String(seg(p, 0.03, 0.12) * (1 - seg(p, 0.86, 0.94)));
    if (center.current) center.current.style.opacity = String(seg(p, 0.02, 0.1) * (1 - out));
  };

  useFrame(stage, (dt) => {
    if (!active) spin.current += dt;
    place();
  });
  useSmoothProgress(orbitRef, (p) => {
    prog.current = p;
    if (reducedMotion()) place();
    setAuto(p < 0.34 ? "all" : p < 0.52 ? "private" : p < 0.7 ? "shared" : "verified");
  });

  return (
    <section ref={orbitRef} className="h-[420vh]" aria-label="Everyone you've tagged, by source">
      <div ref={stage} className="sticky top-0 grid h-dvh place-items-center overflow-hidden">
        <svg aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 overflow-visible" width="1" height="1">
          {RADII.map((_, r) => <circle key={r} ref={(el) => { ringEls.current[r] = el; }} cx="0" cy="0" r="1" fill="none" stroke="#ffd9a8" strokeOpacity=".34" strokeDasharray="2 7" />)}
        </svg>

        <div ref={center} className="absolute left-1/2 top-1/2 z-10 flex w-[30vmin] -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center opacity-0">
          {active ? (
            <div key={active.name} className="pop">
              <p className="text-[clamp(.9rem,2.6vmin,1.5rem)] font-semibold leading-tight">{active.name}</p>
              <p className="mt-1 text-[clamp(.65rem,1.5vmin,.875rem)]" style={{ color: NODE_COLOR[active.source] }}>{active.label}</p>
              <p className="text-[clamp(.65rem,1.5vmin,.875rem)] text-[#9c988b]">{active.wallets} {active.wallets === 1 ? "wallet" : "wallets"}</p>
            </div>
          ) : <BrandMark className="w-[20vmin] text-[#efece3]" />}
        </div>

        {RINGS.map((ring, r) => ring.map((n, i) => {
          const dim = filter !== "all" && n.source !== filter;
          return (
            <button key={n.name} type="button" ref={(el) => { nodeEls.current[r][i] = el; }} aria-label={`${n.name}, ${n.label}, ${n.wallets} wallets`}
              onPointerEnter={() => setActive(n)} onPointerLeave={() => setActive(null)} onFocus={() => setActive(n)} onBlur={() => setActive(null)} onClick={() => setActive(n)}
              className="absolute left-1/2 top-1/2 z-20 will-change-transform" style={{ transform: "scale(0)" }}>
              <span className="grid h-9 min-w-9 place-items-center whitespace-nowrap rounded-full border px-0 text-[11px] font-semibold backdrop-blur-sm transition-all duration-300 md:h-10 md:px-3.5 md:text-sm"
                style={{
                  background: active === n ? NODE_COLOR[n.source] : "#171512d9", color: active === n ? "#141412" : NODE_COLOR[n.source], borderColor: NODE_COLOR[n.source],
                  opacity: dim ? 0.18 : 1, transform: active === n ? "scale(1.28)" : dim ? "scale(.82)" : "none", boxShadow: dim ? "none" : `0 0 24px -6px ${NODE_COLOR[n.source]}`,
                }}><span className="md:hidden">{n.short}</span><span className="hidden md:inline">{n.name}</span></span>
            </button>
          );
        }))}

        <div ref={copy} className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-between pb-20 pt-20 text-center opacity-0 md:pt-24">
          <p key={line} className="pop max-w-3xl px-5 text-2xl font-semibold leading-tight tracking-tight md:text-4xl">{line}</p>
          <div role="group" aria-label="Filter by source" className="pointer-events-auto flex gap-1 rounded-full border border-white/10 bg-black/50 p-1 backdrop-blur-md">
            {FILTERS.map((f) => (
              <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setChosen((c) => (c === f.id ? null : f.id))}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors md:px-4 md:text-sm ${filter === f.id ? "bg-[#fff4e6] text-[#1a0d07]" : "text-[#c9c5b9] hover:text-white"}`}>{f.label}</button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- The product rises out of the light ---------- */

const ROWS: { addr: string; name: string; source: string; tone: Tone; note: string; value: string }[] = [
  { addr: "0x4c1f…2c15", name: "Alice, OTC desk", source: "Your private tag", tone: "mine", note: "4 wallets · X, Telegram", value: "88.0 ETH" },
  { addr: "0x9e0b…77d1", name: "DAO treasury", source: "Shared by Research", tone: "warn", note: "7 wallets · Website, GitHub", value: "310.2 ETH" },
  { addr: "0xb71a…40ce", name: "Exchange hot wallet", source: "Verified", tone: "good", note: "9 wallets · Verified profile", value: "1,204.5 ETH" },
  { addr: "0x03fd…a98b", name: "My cold storage", source: "Your private tag", tone: "mine", note: "2 wallets · Only you", value: "12.0 ETH" },
];

function Product({ productRef }: { productRef: React.RefObject<HTMLElement | null> }) {
  const frame = useRef<HTMLDivElement>(null);
  const [p, setP] = useState(0);
  useSmoothProgress(productRef, (v) => {
    setP((o) => (Math.abs(o - v) > 0.004 ? v : o));
    if (frame.current && !reducedMotion()) {
      const k = ease(seg(v, 0, 0.42));
      frame.current.style.transform = `perspective(1500px) translateY(${(1 - k) * 34}vh) rotateX(${(1 - k) * 34}deg) scale(${0.86 + k * 0.14})`;
      frame.current.style.opacity = String(seg(v, 0, 0.18));
    }
  });
  return (
    <section ref={productRef} className="h-[280vh]" aria-label="Labels on the pages you use">
      <div className="sticky top-0 flex h-dvh flex-col items-center justify-center overflow-hidden px-4 pt-14">
        <h2 className="mb-7 max-w-3xl text-center text-3xl font-semibold leading-tight tracking-tight transition-opacity duration-500 md:text-5xl" style={{ opacity: p > 0.12 ? 1 : 0 }}>Then they show up where you already look.</h2>
        <div ref={frame} className="relative w-full max-w-4xl rounded-2xl p-px" style={{ transform: "perspective(1500px) translateY(34vh) rotateX(34deg) scale(.86)", opacity: 0 }}>
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl" aria-hidden><div className="beam absolute -inset-[60%]" /></div>
          <div className="relative overflow-hidden rounded-2xl bg-[#100e0c]/95 shadow-[0_40px_120px_-20px_rgba(238,106,66,.45)] backdrop-blur-xl">
            <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3 text-xs text-[#9c988b]">
              <span className="size-2.5 rounded-full bg-white/15" /><span className="size-2.5 rounded-full bg-white/15" /><span className="size-2.5 rounded-full bg-white/15" />
              <span className="ml-2">an explorer you already use</span>
            </div>
            <ul className="divide-y divide-white/10">
              {ROWS.map((r, i) => {
                const on = p > 0.42 + i * 0.12;
                return (
                  <li key={r.addr} className="group flex min-h-[4.25rem] flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 transition-colors duration-200 hover:bg-white/5 md:min-h-20 md:px-7">
                    <span className={`addr transition-opacity duration-300 md:text-lg ${on ? "opacity-60" : ""}`}>{r.addr}</span>
                    {on && <span className="pop"><Chip name={r.name} source={r.source} tone={r.tone} className="md:px-2.5 md:py-1 md:text-base" /></span>}
                    {on && <span className="hidden text-xs text-[#9c988b] opacity-0 transition-opacity duration-200 group-hover:opacity-100 lg:inline">{r.note}</span>}
                    <span className="ml-auto text-xs text-[#9c988b] md:text-sm">{r.value}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Cards share one light that follows the cursor ---------- */

function LitCards() {
  const grid = useRef<HTMLDivElement>(null);
  const onMove = (e: React.PointerEvent) => {
    for (const el of Array.from(grid.current!.children) as HTMLElement[]) {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--x", `${e.clientX - r.left}px`);
      el.style.setProperty("--y", `${e.clientY - r.top}px`);
    }
  };
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-24">
      <div ref={grid} onPointerMove={onMove} className="group/grid grid gap-3 md:grid-cols-2">
        {POINTS.map((p, i) => (
          <article key={p.title} className="relative overflow-hidden rounded-2xl p-px" style={{ background: "radial-gradient(420px circle at var(--x, -999px) var(--y, -999px), #ffd9a8, #EE6A42 35%, rgba(255,255,255,.1) 70%)" }}>
            <div className="relative h-full min-h-60 rounded-[calc(1rem-1px)] bg-[#100e0c]/92 p-7 backdrop-blur-xl md:p-9">
              <div aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit]" style={{ background: "radial-gradient(380px circle at var(--x, -999px) var(--y, -999px), rgba(238,106,66,.2), transparent 70%)" }} />
              <span className="addr relative text-[#EE6A42]">0{i + 1}</span>
              <h2 className="relative mt-12 text-2xl font-semibold tracking-tight md:text-4xl">{p.title}</h2>
              <p className="relative mt-3 max-w-md text-[#b5b1a5]">{p.body}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

/* ---------- Footer: the light sets behind our name ---------- */

function Footer({ signedIn, footerRef }: { signedIn: boolean; footerRef: React.RefObject<HTMLElement | null> }) {
  const word = useRef<HTMLParagraphElement>(null);
  const [ref, inView] = useInView<HTMLDivElement>(false);
  const onMove = (e: React.PointerEvent) => {
    const r = word.current?.getBoundingClientRect();
    if (r) { word.current!.style.setProperty("--x", `${e.clientX - r.left}px`); word.current!.style.setProperty("--y", `${e.clientY - r.top}px`); }
  };
  return (
    <footer ref={footerRef} onPointerMove={onMove} className="relative flex min-h-dvh flex-col items-center justify-between overflow-hidden px-5 pb-16 pt-24 text-center md:pb-6">
      <div ref={ref} className={`transition-all duration-1000 ${inView ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"}`}>
        <p className="text-[clamp(2.5rem,6.5vw,6rem)] font-semibold leading-[1] tracking-[-0.03em]">See who&apos;s really there.</p>
        <Link href={signedIn ? "/dashboard" : "/signup"} className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#fff4e6] px-7 py-4 text-lg font-medium text-[#1a0d07] shadow-[0_0_44px_-6px_#EE6A42] transition-[transform,box-shadow] duration-300 hover:scale-[1.04] hover:shadow-[0_0_80px_-4px_#EE6A42] active:scale-95">
          {signedIn ? "Open dashboard" : "Start tagging, it's free"}<span className="cta-arrow" aria-hidden>→</span>
        </Link>
      </div>
      <div className="w-full">
        <p ref={word} role="img" aria-label="TagAWallet" className="select-none whitespace-nowrap text-[17.5vw] font-semibold leading-[1.05] tracking-[-0.04em]"
          style={{ backgroundImage: "radial-gradient(62vw circle at var(--x, 50%) var(--y, 130%), #fff4e6, #ffc9a3 30%, #EE6A42 62%, #8a4426 100%)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>TagAWallet</p>
        <div className="mt-3 flex flex-wrap justify-center gap-5 text-sm text-[#c9c5b9] md:justify-between">
          <span>© {new Date().getFullYear()} TagAWallet</span>
          <span className="flex gap-5"><Link href="/privacy" className="hover:underline">Privacy</Link><Link href="/terms" className="hover:underline">Terms</Link></span>
        </div>
      </div>
    </footer>
  );
}

export function LightLanding({ signedIn }: { signedIn: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const hero = useRef<HTMLElement>(null);
  const orbit = useRef<HTMLElement>(null);
  const product = useRef<HTMLElement>(null);
  const footer = useRef<HTMLElement>(null);

  // Where the eclipse sits at each scroll position of the page.
  useEclipse(canvas, () => {
    if (!orbit.current || !product.current || !footer.current) return [];
    const top = (el: HTMLElement) => el.getBoundingClientRect().top + scrollY;
    const fit = clamp(innerWidth / innerHeight, 0.3, 1); // the disc stays inside the orbit on tall phones
    const H = innerHeight, oT = top(orbit.current), pT = top(product.current), fT = top(footer.current), end = document.documentElement.scrollHeight - H;
    const low = { cy: -1.32, R: 1.1, pow: 1 };
    const mid = { cy: 0, R: 0.165 * fit, pow: 1 };
    const high = { cy: 1.05, R: 0.55, pow: 0.75 };
    return [
      { y: 0, ...low },
      { y: oT, ...mid },
      { y: pT - H * 1.1, ...mid },
      { y: pT - H * 0.1, ...high },
      { y: fT - H * 0.2, cy: 1.05, R: 0.55, pow: 0.4 },
      { y: end, cy: -1.38, R: 1.1, pow: 1.5 },
    ];
  });

  return (
    <div className="v3-dark relative min-h-dvh text-[var(--ink)]" style={{ background: "radial-gradient(120% 60% at 50% 110%, #7a2b12, #0a0908 70%)" }}>
      <canvas ref={canvas} aria-hidden className="pointer-events-none fixed inset-0 size-full" />
      <div className="relative">
        <PillNav signedIn={signedIn} />
        <main>
          <Hero signedIn={signedIn} heroRef={hero} />
          <Orbit orbitRef={orbit} />
          <Product productRef={product} />
          <LitCards />
          <section className="mx-auto w-full max-w-4xl px-5 py-24">
            <ScrollWords text={NOT_A_WALLET} className="text-3xl font-semibold leading-tight tracking-tight md:text-5xl" />
          </section>
        </main>
        <Footer signedIn={signedIn} footerRef={footer} />
      </div>
    </div>
  );
}
