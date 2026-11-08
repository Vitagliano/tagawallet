"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { MARK_FILL } from "@/components/brand-mark";
import { MARK_PARTS } from "@/components/brand-mark-paths";
import { clamp, ease, reducedMotion, seg, useFrame, useInView } from "../shared";
import { PillNav, useSmoothProgress } from "./kit";

const ORANGE = "#EE6A42", INK = "#1a1a18", CREAM = "#f6f4ee", GREEN = "#1b7a4a", AMBER = "#E9B44C";

/* ---------- Hero: a field of tags you can push, throw and flip ---------- */

type Float = { name: string; addr: string; bg: string; fg: string; x: number; y: number; mx: number; my: number; z: number; rot: number; big?: boolean; phone?: boolean };
// x/y are desktop anchors, mx/my phone anchors, both as fractions of the stage. They keep clear of the headline.
const FLOATS: Float[] = [
  { name: "Alice, OTC desk", addr: "0x4c1f…2c15", bg: ORANGE, fg: INK, x: 0.13, y: 0.2, mx: 0.28, my: 0.14, z: 1, rot: -7, big: true, phone: true },
  { name: "DAO treasury", addr: "0x9e0b…77d1", bg: AMBER, fg: INK, x: 0.84, y: 0.18, mx: 0.74, my: 0.19, z: 0.9, rot: 6, big: true, phone: true },
  { name: "Exchange hot wallet", addr: "0xb71a…40ce", bg: GREEN, fg: "#fff", x: 0.8, y: 0.8, mx: 0.68, my: 0.84, z: 1, rot: -5, big: true, phone: true },
  { name: "My cold storage", addr: "0x03fd…a98b", bg: INK, fg: "#fff", x: 0.15, y: 0.78, mx: 0.3, my: 0.79, z: 0.95, rot: 5, big: true, phone: true },
  { name: "Bob, market maker", addr: "0x72ca…1e06", bg: "#fffefb", fg: INK, x: 0.31, y: 0.1, mx: 0.72, my: 0.73, z: 0.6, rot: 3, phone: true },
  { name: "Grants multisig", addr: "0xd5e2…9f30", bg: "#fffefb", fg: INK, x: 0.68, y: 0.09, mx: 0.26, my: 0.25, z: 0.55, rot: -3, phone: true },
  { name: "Team vesting", addr: "0x18ab…c7e4", bg: ORANGE, fg: INK, x: 0.93, y: 0.46, mx: 0, my: 0, z: 0.5, rot: 8 },
  { name: "Bridge contract", addr: "0x6f94…03ad", bg: "#fffefb", fg: INK, x: 0.06, y: 0.48, mx: 0, my: 0, z: 0.45, rot: -9 },
  { name: "Airdrop farmer?", addr: "0xe2c7…58b1", bg: AMBER, fg: INK, x: 0.37, y: 0.9, mx: 0.26, my: 0.9, z: 0.6, rot: -4, phone: true },
  { name: "Whale, probably", addr: "0x3ad0…e612", bg: GREEN, fg: "#fff", x: 0.61, y: 0.91, mx: 0, my: 0, z: 0.5, rot: 4 },
];

function Hole({ fg }: { fg: string }) {
  return <span className="mr-2.5 size-[.62em] shrink-0 rounded-full ring-2" style={{ background: "var(--paper)", boxShadow: `inset 0 1px 2px ${fg}55` }} aria-hidden />;
}

function HeroStage({ signedIn }: { signedIn: boolean }) {
  const root = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const copy = useRef<HTMLDivElement>(null);
  const els = useRef<(HTMLButtonElement | null)[]>([]);
  const mark = useRef<SVGSVGElement>(null);
  const parts = useRef<Record<string, SVGPathElement | null>>({});
  const hint = useRef<HTMLDivElement>(null);
  const line = useRef<HTMLParagraphElement>(null);
  const [flipped, setFlipped] = useState<Record<number, boolean>>({});

  // Offsets from each tag's anchor. They begin bunched behind the headline, then spring out.
  const bodies = useRef(FLOATS.map((f) => ({ ox: (0.5 - f.x) * 900, oy: (0.5 - f.y) * 500, vx: 0, vy: 0, s: 0, vs: 0, r: 0, vr: 0, phase: f.x * 19 })));
  const mouse = useRef({ x: -1e4, y: -1e4, nx: 0, ny: 0 });
  const grab = useRef<{ i: number; x: number; y: number; moved: number } | null>(null);
  const prog = useRef(0);

  const apply = (dt: number, t: number) => {
    const box = stage.current;
    if (!box) return;
    const W = box.clientWidth, H = box.clientHeight, phone = W < 720, p = prog.current;
    const funnel = ease(seg(p, 0.04, 0.34));
    const m = mouse.current;
    FLOATS.forEach((f, i) => {
      const b = bodies.current[i], el = els.current[i];
      if (!el) return;
      if (phone && !f.phone) { el.style.display = "none"; return; }
      el.style.display = "";
      const ax = (phone ? f.mx : f.x) * W, ay = (phone ? f.my : f.y) * H;
      // Parallax: nearer tags (higher z) drift further against the cursor.
      const tx = -m.nx * 34 * f.z + Math.sin(t * 0.7 + b.phase) * 7 * f.z;
      const ty = -m.ny * 24 * f.z + Math.cos(t * 0.55 + b.phase) * 9 * f.z;
      const held = grab.current?.i === i;
      if (held) {
        const nx = grab.current!.x - ax, ny = grab.current!.y - ay;
        b.vx = clamp((nx - b.ox) / Math.max(dt, 0.008) * 0.6, -1800, 1800); b.vy = clamp((ny - b.oy) / Math.max(dt, 0.008) * 0.6, -1800, 1800);
        b.ox = nx; b.oy = ny;
      } else {
        const dx = ax + b.ox - m.x, dy = ay + b.oy - m.y, d = Math.hypot(dx, dy) || 1;
        const push = d < 210 ? (1 - d / 210) ** 2 * 5200 * f.z : 0;
        // Soft spring: thrown tags travel, then come home with a little overshoot.
        b.vx += ((tx - b.ox) * 26 - b.vx * 5.2 + (dx / d) * push) * dt;
        b.vy += ((ty - b.oy) * 26 - b.vy * 5.2 + (dy / d) * push) * dt;
        b.ox += b.vx * dt; b.oy += b.vy * dt;
      }
      b.vs += ((1 - b.s) * 150 - b.vs * 15) * dt * (t > i * 0.045 ? 1 : 0);
      b.s += b.vs * dt;
      // Spin follows sideways speed, so a throw visibly tumbles.
      b.vr += ((f.rot + clamp(b.vx * 0.022, -28, 28) - b.r) * 40 - b.vr * 9) * dt;
      b.r += b.vr * dt;
      // On scroll, each tag falls into the wallet at the bottom of the screen.
      const cx = W / 2, cy = H * 0.72, k = clamp(funnel * 1.25 - (1 - f.z) * 0.2);
      const x = ax + b.ox + (cx - (ax + b.ox)) * k, y = ay + b.oy + (cy - (ay + b.oy)) * k;
      el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) rotate(${b.r + k * 40 * (i % 2 ? 1 : -1)}deg) scale(${Math.max(0, b.s) * (0.72 + f.z * 0.28) * (1 - k * 0.8)})`;
      el.style.opacity = String(1 - seg(k, 0.82, 1));
      el.style.zIndex = held ? "30" : String(Math.round(f.z * 10));
      el.style.pointerEvents = k > 0.3 ? "none" : "";
    });
  };

  useFrame(root, apply);
  useEffect(() => {
    if (!reducedMotion()) return;
    bodies.current.forEach((b, i) => { b.ox = 0; b.oy = 0; b.s = 1; b.r = FLOATS[i].rot; });
    apply(0, 10);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useSmoothProgress(root, (p) => {
    prog.current = p;
    const W = innerWidth, H = innerHeight;
    if (reducedMotion()) apply(0, 10);
    if (copy.current) {
      const k = seg(p, 0.03, 0.17);
      copy.current.style.opacity = String(1 - k);
      copy.current.style.transform = `translateY(${-k * 80}px) scale(${1 - k * 0.06})`;
      copy.current.style.visibility = k >= 1 ? "hidden" : "visible";
    }
    if (hint.current) hint.current.style.opacity = String(1 - seg(p, 0, 0.03));
    const rise = ease(seg(p, 0.02, 0.3));
    const zoom = seg(p, 0.5, 0.97);
    if (mark.current) {
      const size = mark.current.clientWidth || 300;
      // Big enough that the tag's body alone covers the far corner of the viewport.
      const cover = (Math.hypot(W, H) / (size * 0.17)) * 1.2;
      const s = 1 + (cover - 1) * zoom ** 3.2;
      const y = (1 - rise) * (H * 0.72 + size);
      mark.current.style.transform = `translateY(${y}px) scale(${s})`;
      mark.current.style.visibility = p >= 0.975 ? "hidden" : "visible";
    }
    // Everything but the orange tag leaves, so the tag can become the next section.
    for (const part of MARK_PARTS) {
      const el = parts.current[part.id];
      if (el && part.id !== "tag") el.style.opacity = String(1 - seg(p, 0.5, 0.58));
    }
    if (line.current) {
      const k = seg(p, 0.2, 0.28) * (1 - seg(p, 0.46, 0.52));
      line.current.style.opacity = String(k);
      line.current.style.transform = `translateY(${(1 - k) * 18}px)`;
    }
    if (stage.current) stage.current.style.background = p >= 0.965 ? ORANGE : "transparent";
  });

  const local = (e: React.PointerEvent) => {
    const r = stage.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  return (
    <section ref={root} className="h-[300vh]" aria-label="Introduction">
      <div ref={stage} className="sticky top-0 h-dvh select-none overflow-hidden"
        onPointerMove={(e) => {
          const p = local(e), W = stage.current!.clientWidth, H = stage.current!.clientHeight;
          if (e.pointerType === "mouse") { mouse.current.x = p.x; mouse.current.y = p.y; mouse.current.nx = p.x / W - 0.5; mouse.current.ny = p.y / H - 0.5; }
          if (grab.current) { grab.current.moved += Math.abs(p.x - grab.current.x) + Math.abs(p.y - grab.current.y); grab.current.x = p.x; grab.current.y = p.y; }
        }}
        onPointerLeave={() => { mouse.current.x = mouse.current.y = -1e4; }}>
        <div ref={copy} className="pointer-events-none absolute inset-0 z-[5] flex flex-col items-center justify-center px-5 text-center">
          <h1 className="text-[clamp(3rem,9vw,8.5rem)] font-semibold leading-[.96] tracking-[-0.035em]">
            <span className="block overflow-hidden pb-[.08em]"><span className="word-rise">Know who&apos;s behind</span></span>
            <span className="block overflow-hidden pb-[.08em]"><span className="word-rise" style={{ "--d": "90ms" } as React.CSSProperties}>every wallet.</span></span>
          </h1>
          <p className="rise mt-5 max-w-lg text-muted md:text-lg" style={{ "--d": "260ms" } as React.CSSProperties}>Privately tag addresses, link socials, group related wallets, and recognize identities wherever you research and trade.</p>
          <div className="rise pointer-events-auto mt-6" style={{ "--d": "340ms" } as React.CSSProperties}>
            <Link href={signedIn ? "/dashboard" : "/signup"} className="group inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3.5 text-lg font-medium text-paper transition-transform duration-200 hover:scale-[1.04] active:scale-95">
              {signedIn ? "Open dashboard" : "Start tagging, it's free"}<span className="cta-arrow" aria-hidden>→</span>
            </Link>
          </div>
        </div>

        {FLOATS.map((f, i) => (
          <button key={f.name} type="button" ref={(el) => { els.current[i] = el; }}
            aria-pressed={!!flipped[i]} aria-label={`${f.name}. Show address ${f.addr}`}
            onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); const p = local(e); grab.current = { i, x: p.x, y: p.y, moved: 0 }; }}
            onPointerUp={() => { if (grab.current?.i === i && grab.current.moved < 6) setFlipped((s) => ({ ...s, [i]: !s[i] })); grab.current = null; }}
            onLostPointerCapture={() => { if (grab.current?.i === i) grab.current = null; }}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setFlipped((s) => ({ ...s, [i]: !s[i] })); } }}
            className={`absolute left-0 top-0 cursor-grab touch-none select-none whitespace-nowrap rounded-l-full rounded-r-2xl py-[.55em] pl-[.75em] pr-[1em] font-semibold shadow-[0_14px_34px_-12px_rgba(0,0,0,.4)] active:cursor-grabbing ${f.big ? "text-base md:text-3xl" : "text-sm md:text-xl"}`}
            style={{ background: f.bg, color: f.fg, transform: "translate(-999px,-999px)", border: f.bg === "#fffefb" ? "1px solid #dfdbcf" : f.bg === INK ? "1px solid rgba(255,255,255,.2)" : undefined }}>
            <span className="flex items-center">
              <Hole fg={f.fg} />
              <span className="grid">
                <span className={`col-start-1 row-start-1 transition-all duration-300 ${flipped[i] ? "-translate-y-2 opacity-0" : ""}`}>{f.name}</span>
                <span className={`addr col-start-1 row-start-1 transition-all duration-300 ${flipped[i] ? "" : "translate-y-2 opacity-0"}`}>{f.addr}</span>
              </span>
            </span>
          </button>
        ))}

        <div ref={hint} className="absolute inset-x-0 bottom-20 z-[5] hidden text-center text-xs text-muted md:block"><p className="rise" style={{ "--d": "900ms" } as React.CSSProperties}>Throw a tag. Click one to see the address behind it.</p></div>

        <p ref={line} className="pointer-events-none absolute inset-x-0 top-[13dvh] z-20 px-5 text-center text-[clamp(2.25rem,5.6vw,5.5rem)] font-semibold leading-none tracking-[-0.03em] opacity-0">Tag it once. Know it everywhere.</p>
        <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center pt-[10dvh]">
          <svg ref={mark} viewBox="0 0 515 415" fill="none" aria-hidden className="w-[min(64vw,46vh)] overflow-visible text-ink" style={{ transformOrigin: "27.5% 64%", transform: "translateY(200vh)" }}>
            {MARK_PARTS.map((part) => (
              <path key={part.id} ref={(el) => { parts.current[part.id] = el; }} d={part.d} fill={MARK_FILL[part.tone]} fillRule={part.evenodd ? "evenodd" : undefined} clipRule={part.evenodd ? "evenodd" : undefined} />
            ))}
          </svg>
        </div>
      </div>
    </section>
  );
}

/* ---------- A chat that finally makes sense ---------- */

const LONG_ADDR = "0x4c1fA8e27B03d96E5f71aC28D04bE6637fA92c15";
const BEATS = [
  { from: "them", at: 0.08, text: "Who did we pay last week?" },
  { from: "me", at: 0.2, text: "addr" },
  { from: "them", at: 0.34, text: "That's not a who." },
  { from: "me", at: 0.46, text: "It's all I've got." },
  { from: "them", at: 0.72, text: "Oh, Alice! Why didn't you say so?" },
];
const STAMP_AT = 0.58;

function Bubble({ from, children }: { from: string; children: React.ReactNode }) {
  const mine = from === "me";
  return (
    <div className={`pop w-fit max-w-[92%] origin-bottom rounded-[1.4rem] px-4 py-2.5 text-base shadow-lg md:px-6 md:py-3.5 md:text-2xl ${mine ? "ml-auto rounded-br-md bg-[#1a1a18] text-white" : "rounded-bl-md bg-[#fffefb] text-[#1a1a18]"}`}>{children}</div>
  );
}

function Typing({ from }: { from: string }) {
  return (
    <Bubble from={from}>
      <span className="flex h-6 items-center gap-1" aria-label="Typing">
        {[0, 1, 2].map((i) => <span key={i} className="typing-dot size-1.5 rounded-full bg-current" style={{ animationDelay: `${i * 130}ms` }} />)}
      </span>
    </Bubble>
  );
}

function Sparks({ on }: { on: boolean }) {
  if (!on) return null;
  return (
    <span className="pointer-events-none absolute left-1/2 top-1/2" aria-hidden>
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2, d = 70 + (i % 3) * 34;
        return (
          <span key={i} className="absolute h-3 w-1.5 rounded-full" style={{
            background: i % 2 ? AMBER : "#fff", transform: `rotate(${a + Math.PI / 2}rad)`,
          }} ref={(el) => {
            el?.animate([{ translate: "0 0", opacity: 1 }, { translate: `${Math.cos(a) * d}px ${Math.sin(a) * d}px`, opacity: 0 }], { duration: 620, easing: "cubic-bezier(.1,.8,.3,1)", fill: "forwards" });
          }} />
        );
      })}
    </span>
  );
}

function Chat() {
  const root = useRef<HTMLElement>(null);
  const [p, setP] = useState(0);
  useSmoothProgress(root, (v) => setP((old) => (Math.abs(old - v) > 0.002 ? v : old)));
  const stamped = p >= STAMP_AT;
  return (
    <section ref={root} className="h-[420vh]" style={{ background: ORANGE, color: INK }} aria-label="Why addresses need names">
      <div className="sticky top-0 flex h-dvh items-center overflow-hidden">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-8 px-5 pt-16 md:grid-cols-[1fr_1.05fr] md:gap-14 md:pt-0">
          <h2 className="text-[clamp(2.4rem,5.6vw,5.5rem)] font-semibold leading-[1] tracking-[-0.03em]">
            Addresses were never meant for people.
            <span className={`block transition-all duration-500 ${p >= 0.84 ? "translate-y-0 text-white opacity-100" : "translate-y-3 opacity-0"}`}>Names are.</span>
          </h2>
          <div className="flex min-h-[360px] flex-col justify-end gap-2.5 md:min-h-[440px] md:gap-3" aria-live="polite">
            {BEATS.map((b, i) => {
              if (p < b.at - 0.05) return null;
              if (p < b.at) return <Typing key={i} from={b.from} />;
              if (b.text !== "addr") return <Bubble key={i} from={b.from}>{b.text}</Bubble>;
              return (
                <Bubble key={i} from={b.from}>
                  <span className="relative block">
                    <span className={`addr block break-all text-sm leading-snug transition-all duration-300 md:text-lg ${stamped ? "scale-[.97] opacity-25 blur-[1.5px]" : ""}`}>{LONG_ADDR}</span>
                    {stamped && (
                      <span className="stamp absolute inset-0 grid place-items-center">
                        <span className="whitespace-nowrap rounded-l-full rounded-r-xl px-4 py-1.5 text-lg font-semibold shadow-xl md:text-3xl" style={{ background: ORANGE, color: INK }}>Alice, OTC desk</span>
                      </span>
                    )}
                    <Sparks on={stamped} />
                  </span>
                </Bubble>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Big statements. The whole page changes color as you read. ---------- */

function PrivacyGlyph() {
  const [shared, setShared] = useState(false);
  return (
    <button type="button" role="switch" aria-checked={shared} aria-label="Share this list with your team" onClick={() => setShared((v) => !v)}
      className="relative mx-[.12em] inline-flex h-[.82em] w-[1.75em] items-center rounded-full align-[-.06em] transition-colors duration-300" style={{ background: shared ? ORANGE : "#3a3934" }}>
      <span className="absolute top-[.07em] grid size-[.68em] place-items-center rounded-full bg-white transition-all duration-500 ease-[cubic-bezier(.3,1.5,.5,1)]" style={{ left: shared ? "1em" : ".07em" }}>
        <svg viewBox="0 0 24 24" className="size-[.42em]" fill="none" stroke={INK} strokeWidth="2.6" aria-hidden>
          {shared ? <><circle cx="8" cy="9" r="3.5" /><circle cx="17" cy="10" r="2.6" /><path d="M2 20c.6-4 3-6 6-6s5.400 2 6 6M16 14.500c3 0 5 1.600 5.600 4.500" /></> : <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>}
        </svg>
      </span>
    </button>
  );
}

function FanGlyph() {
  const [open, setOpen] = useState(false);
  const [ref, inView] = useInView<HTMLSpanElement>(false);
  const spread = open || inView;
  const colors = [GREEN, AMBER, ORANGE, INK];
  return (
    <span ref={ref} onPointerEnter={() => setOpen(true)} onPointerLeave={() => setOpen(false)} className="relative mx-[.16em] inline-block h-[.82em] w-[1.5em] align-[-.08em]" aria-hidden>
      {colors.map((c, i) => (
        <span key={c} className="absolute inset-y-0 left-1/2 w-[.72em] rounded-[.12em] border border-black/10 shadow-md transition-transform duration-700 ease-[cubic-bezier(.3,1.4,.5,1)]"
          style={{ background: c, transitionDelay: `${i * 45}ms`, transform: spread ? `translateX(${-50 + (i - 1.5) * (open ? 62 : 44)}%) rotate(${(i - 1.5) * (open ? 13 : 9)}deg)` : "translateX(-50%)" }} />
      ))}
    </span>
  );
}

const SOURCES = [
  { name: "Your private tag", bg: "#fffefb", fg: INK },
  { name: "Shared by Research", bg: AMBER, fg: INK },
  { name: "Self-claimed", bg: ORANGE, fg: INK },
  { name: "Verified", bg: "#0e4f2f", fg: "#fff" },
];

function SourceGlyph() {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reducedMotion()) return;
    const id = setInterval(() => setI((v) => (v + 1) % SOURCES.length), 1800);
    return () => clearInterval(id);
  }, []);
  const s = SOURCES[i];
  return (
    <button type="button" onClick={() => setI((v) => (v + 1) % SOURCES.length)} aria-label={`Source: ${s.name}. Show the next source.`}
      className="mx-[.12em] inline-grid h-[.82em] min-w-[3.4em] place-items-center overflow-hidden rounded-[.16em] align-[-.08em] shadow-lg transition-colors duration-300" style={{ background: s.bg, color: s.fg }}>
      <span key={s.name} className="pop whitespace-nowrap px-[.3em] text-[.36em] font-semibold tracking-normal">{s.name}</span>
    </button>
  );
}

function BrowserGlyph() {
  const [tagged, setTagged] = useState(false);
  const [ref, inView] = useInView<HTMLButtonElement>(false);
  useEffect(() => {
    if (!inView || reducedMotion()) return;
    const id = setInterval(() => setTagged((v) => !v), 1500);
    return () => clearInterval(id);
  }, [inView]);
  return (
    <button ref={ref} type="button" onClick={() => setTagged((v) => !v)} aria-label="Toggle the tag on this page" className="mx-[.14em] inline-flex h-[.82em] w-[2.3em] flex-col overflow-hidden rounded-[.13em] bg-white align-[-.08em] shadow-xl">
      <span className="flex h-[.17em] items-center gap-[.03em] bg-[#e7e3d8] px-[.05em]">{[0, 1, 2].map((d) => <span key={d} className="size-[.05em] rounded-full bg-black/25" />)}</span>
      <span className="flex flex-1 items-center justify-center">
        {tagged ? <span key="t" className="pop rounded-l-full rounded-r-md px-[.4em] py-[.12em] text-[.27em] font-semibold tracking-normal" style={{ background: ORANGE, color: INK }}>Alice, OTC desk</span>
          : <span key="a" className="font-mono tracking-normal text-black/50" style={{ fontSize: ".24em" }}>0x4c1f…2c15</span>}
      </span>
    </button>
  );
}

const STATEMENTS: { bg: string; fg: string; a: string; glyph: React.ReactNode; b: string; body: string }[] = [
  { bg: INK, fg: "#f6f4ee", a: "Private", glyph: <PrivacyGlyph />, b: "by default.", body: "Lists, notes and labels are yours alone until you invite someone. There is no public feed of what you're researching." },
  { bg: CREAM, fg: INK, a: "One entity,", glyph: <FanGlyph />, b: "many wallets.", body: "Group every address of a person, project, DAO or exchange across chains, with the links that back it up." },
  { bg: GREEN, fg: "#fff", a: "Every label", glyph: <SourceGlyph />, b: "shows its source.", body: "Your private tag, a shared list, a self-claim or a verified profile. You always know who is saying what." },
  { bg: AMBER, fg: INK, a: "Right where", glyph: <BrowserGlyph />, b: "you already work.", body: "Chips appear next to addresses on explorers, X and trading tools you enable. Page content never leaves your browser." },
];

function Statement({ s, onActive }: { s: (typeof STATEMENTS)[number]; onActive: () => void }) {
  const ref = useRef<HTMLElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { onActive(); setSeen(true); } }, { rootMargin: "-48% 0px -48% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [onActive]);
  return (
    <section ref={ref} className="flex min-h-[105dvh] flex-col items-center justify-center px-5 py-24 text-center" style={{ color: s.fg }}>
      <h2 className="max-w-[16ch] text-[clamp(2.75rem,8.2vw,8rem)] font-semibold leading-[1.08] tracking-[-0.035em]">{s.a} <span className="my-[.08em] block md:my-0 md:inline">{s.glyph}</span> {s.b}</h2>
      <p className={`mt-7 max-w-xl text-base opacity-0 transition-all duration-700 md:text-xl ${seen ? "translate-y-0 opacity-80" : "translate-y-4"}`}>{s.body}</p>
    </section>
  );
}

function ColorRun() {
  const [bg, setBg] = useState(ORANGE);
  return (
    <div className="transition-colors duration-700 ease-out" style={{ background: bg }}>
      {STATEMENTS.map((s) => <Statement key={s.a} s={s} onActive={() => setBg(s.bg)} />)}
      <NotAWallet onActive={() => setBg(CREAM)} />
    </div>
  );
}

function NotAWallet({ onActive }: { onActive: () => void }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) onActive(); }, { rootMargin: "-48% 0px -48% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [onActive]);
  return (
    <section ref={ref} className="mx-auto flex min-h-[70dvh] max-w-3xl flex-col items-center justify-center px-5 py-20 text-center" style={{ color: INK }}>
      <p className="text-3xl font-semibold leading-tight tracking-tight md:text-5xl">Despite the name, it&apos;s not a wallet.</p>
      <p className="mt-5 text-lg opacity-70 md:text-xl">It holds no funds and will never ask for your seed phrase, private key or a transaction signature. Anyone asking for those in our name is not us.</p>
    </section>
  );
}

/* ---------- Footer: a split-flap board that resolves into our name ---------- */

const FLAP = "0123456789abcdefxX";
const WORD = "TagAWallet";

function Flap({ target, index, run, onHover }: { target: string; index: number; run: number; onHover: () => void }) {
  const [ch, setCh] = useState(FLAP[index + 2]);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (run === 0) return;
    if (reducedMotion()) { setCh(target); return; }
    let n = 7 + index * 2;
    const id = setInterval(() => {
      n--;
      setCh(n <= 0 ? target : FLAP[Math.floor(Math.random() * FLAP.length)]);
      setTick((v) => v + 1);
      if (n <= 0) clearInterval(id);
    }, 62);
    return () => clearInterval(id);
  }, [run, target, index]);
  return (
    <span onPointerEnter={onHover} className="relative grid aspect-[3/4.2] flex-1 place-items-center overflow-hidden rounded-[.8vw] bg-[#1a1a18] text-[clamp(1.5rem,8.2vw,9.5rem)] font-semibold leading-none text-white shadow-[0_1vw_2vw_-1vw_rgba(0,0,0,.6)] transition-transform duration-200 ease-out hover:-translate-y-[6%]" aria-hidden>
      <span key={tick} className="flap-char">{ch}</span>
      <span className="absolute inset-x-0 top-1/2 h-[max(1px,.15vw)] bg-[#ee6a42]" />
    </span>
  );
}

function FlapBoard() {
  const [ref, inView] = useInView<HTMLDivElement>(false);
  const [runs, setRuns] = useState(() => WORD.split("").map(() => 0));
  useEffect(() => { if (inView) setRuns((r) => r.map((v) => v + 1)); }, [inView]);
  return (
    <div ref={ref} role="img" aria-label="TagAWallet" className="flex gap-[.6vw]">
      {WORD.split("").map((c, i) => <Flap key={i} target={c} index={i} run={runs[i]} onHover={() => setRuns((r) => r.map((v, k) => (k === i ? v + 1 : v)))} />)}
    </div>
  );
}

function Footer({ signedIn }: { signedIn: boolean }) {
  return (
    <footer style={{ background: ORANGE, color: INK }} className="overflow-hidden">
      <div className="mx-auto w-full max-w-7xl px-5 pb-20 pt-20 md:px-8 md:pt-28">
        <p className="max-w-4xl text-[clamp(2.75rem,8vw,7.5rem)] font-semibold leading-[.98] tracking-[-0.035em]">Go put a name on it.</p>
        <Link href={signedIn ? "/dashboard" : "/signup"} className="group mt-8 inline-flex items-center gap-2 rounded-full bg-[#1a1a18] px-7 py-4 text-lg font-medium text-white transition-transform duration-200 hover:scale-[1.04] active:scale-95">
          {signedIn ? "Open dashboard" : "Start tagging, it's free"}<span className="cta-arrow" aria-hidden>→</span>
        </Link>
        <div className="mt-16 md:mt-24"><FlapBoard /></div>
        <div className="mt-8 flex flex-wrap justify-between gap-4 text-sm font-medium">
          <span>© {new Date().getFullYear()} TagAWallet</span>
          <span className="flex gap-5">
            <Link href="/privacy" className="hover:underline">Privacy</Link>
            <Link href="/terms" className="hover:underline">Terms</Link>
          </span>
        </div>
      </div>
    </footer>
  );
}

export function NamesLanding({ signedIn }: { signedIn: boolean }) {
  return (
    <>
      <PillNav signedIn={signedIn} />
      <main>
        <HeroStage signedIn={signedIn} />
        <Chat />
        <ColorRun />
      </main>
      <Footer signedIn={signedIn} />
    </>
  );
}

export { HeroStage as NamesHero, Chat as NamesChat, ColorRun as NamesColorRun, Footer as NamesFooter, ORANGE, INK };
export { STATEMENTS, Statement, NotAWallet, Flap, AMBER, GREEN, CREAM };
