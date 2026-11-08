"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { chainsInFamily, CHAINS, parsePastedAddress, truncateAddress, type ChainFamily } from "@tagawallet/shared";
import { BrandMark } from "@/components/brand-mark";
import { clamp, ease, reducedMotion, seg, useFrame } from "../shared";
import { PillNav, useSmoothProgress } from "./kit";

const SWATCHES = [
  { id: "orange", bg: "#EE6A42", fg: "#1a0d07", sub: "#1a0d07b0" },
  { id: "ink", bg: "#1a1a18", fg: "#f6f4ee", sub: "#f6f4eea8" },
  { id: "green", bg: "#1b7a4a", fg: "#ffffff", sub: "#ffffffb8" },
  { id: "amber", bg: "#E9B44C", fg: "#1a1a18", sub: "#1a1a18ad" },
  { id: "cream", bg: "#fffefb", fg: "#1a1a18", sub: "#1a1a18a0" },
];
type Swatch = (typeof SWATCHES)[number];

const SAMPLES = [
  { address: "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed", name: "Alice, OTC desk" },
  { address: "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq", name: "Old Bitcoin stash" },
  { address: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU", name: "Solana trading wallet" },
  { address: "yourname.eth", name: "A friend" },
];

type Tag = { address: string; name: string; swatch: Swatch; short: string; chain: string; valid: boolean };

function describe(address: string) {
  const hit = parsePastedAddress(address);
  if (!hit) return { valid: false, chain: "", short: address.trim() ? truncateAddress(address.trim()) : "0x…" };
  if (hit.kind === "ens") return { valid: true, chain: "ENS name", short: hit.normalized };
  if (hit.kind === "sns") return { valid: true, chain: "Solana name", short: hit.normalized };
  const chains = chainsInFamily(hit.kind as ChainFamily).map((c) => CHAINS[c].name);
  return { valid: true, chain: chains.length > 2 ? `${chains[0]}, ${chains[1]} +${chains.length - 2}` : chains.join(", "), short: truncateAddress(hit.raw) };
}

/** A small symmetric pattern that is always the same for the same address. */
function Identicon({ seed, fg, className = "" }: { seed: string; fg: string; className?: string }) {
  const cells = useMemo(() => {
    let h = 2166136261;
    for (const c of seed.toLowerCase()) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
    const out: [number, number][] = [];
    for (let y = 0; y < 5; y++) for (let x = 0; x < 3; x++) {
      h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
      if (h % 100 < 52) { out.push([x, y]); if (x < 2) out.push([4 - x, y]); }
    }
    return out;
  }, [seed]);
  return <svg viewBox="0 0 5 5" className={className} aria-hidden>{cells.map(([x, y]) => <rect key={`${x}-${y}`} x={x + 0.06} y={y + 0.06} width=".88" height=".88" rx=".16" fill={fg} />)}</svg>;
}

/* ---------- Lanyard ---------- */

const SEGMENTS = 9;
type P = { x: number; y: number; px: number; py: number };

function Lanyard({ tag, jiggle }: { tag: Tag; jiggle: number }) {
  const root = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const shine = useRef<HTMLDivElement>(null);
  const strap = useRef<SVGPathElement>(null);
  const strapText = useRef<SVGPathElement>(null);
  const clip = useRef<HTMLSpanElement>(null);
  const rope = useRef<P[]>([]);
  const drag = useRef<{ dx: number; dy: number; x: number; y: number } | null>(null);
  const pointer = useRef({ x: 0.5, y: 0.3 });
  const yaw = useRef(0);
  const [dragged, setDragged] = useState(false);

  const size = () => {
    const w = root.current!.clientWidth, h = root.current!.clientHeight;
    return { w, h, len: Math.min(h * 0.3, 240), anchor: { x: w / 2, y: -30 } };
  };
  const reset = () => {
    const { len, anchor } = size();
    rope.current = Array.from({ length: SEGMENTS }, (_, i) => {
      // Starts off to one side and falls in, so the card arrives with a swing.
      const k = i / (SEGMENTS - 1), x = anchor.x + k * 150, y = anchor.y + k * len * 0.8;
      return { x, y, px: x, py: y };
    });
  };
  const paint = () => {
    const pts = rope.current;
    if (!pts.length) return;
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i + 1].x) / 2, my = (pts[i].y + pts[i + 1].y) / 2;
      d += ` Q ${pts[i].x} ${pts[i].y} ${mx} ${my}`;
    }
    const end = pts[pts.length - 1], prev = pts[pts.length - 3];
    d += ` L ${end.x} ${end.y}`;
    strap.current?.setAttribute("d", d);
    strapText.current?.setAttribute("d", d);
    const angle = Math.atan2(end.y - prev.y, end.x - prev.x) - Math.PI / 2;
    const vx = end.x - end.px;
    yaw.current += (clamp(vx * 3.5 + (pointer.current.x - 0.5) * 18, -38, 38) - yaw.current) * 0.14;
    const tilt = (pointer.current.y - 0.5) * -10;
    if (card.current) card.current.style.transform = `translate(${end.x}px, ${end.y}px) translate(-50%, -16px) rotate(${clamp(angle, -0.85, 0.85)}rad) perspective(900px) rotateY(${yaw.current}deg) rotateX(${tilt}deg)`;
    if (clip.current) { clip.current.style.transform = `translate(${end.x}px, ${end.y}px) translate(-50%, -50%) rotate(${clamp(angle, -0.85, 0.85)}rad)`; }
    if (shine.current) shine.current.style.backgroundPosition = `${50 + yaw.current * 2.2}% ${50 + tilt * 3}%`;
  };

  useEffect(() => {
    reset();
    paint();
    if (reducedMotion()) {
      const { len, anchor } = size();
      rope.current.forEach((p, i) => { p.x = p.px = anchor.x; p.y = p.py = anchor.y + (i / (SEGMENTS - 1)) * len; });
      paint();
    }
    const on = () => { reset(); paint(); };
    addEventListener("resize", on);
    return () => removeEventListener("resize", on);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Typing nudges the card, so the tag feels connected to the form.
  useEffect(() => {
    const end = rope.current[SEGMENTS - 1];
    if (end && jiggle > 0) end.px = end.x - (jiggle % 2 ? 7 : -7);
  }, [jiggle]);

  useFrame(root, (dt) => {
    if (!root.current) return;
    const { len, anchor } = size(), step = len / (SEGMENTS - 1), pts = rope.current;
    if (!pts.length) return;
    const g = 1500 * dt * dt;
    for (let i = 1; i < SEGMENTS; i++) {
      const p = pts[i], vx = (p.x - p.px) * 0.988, vy = (p.y - p.py) * 0.988;
      p.px = p.x; p.py = p.y;
      p.x += vx; p.y += vy + g * (i === SEGMENTS - 1 ? 2.4 : 1);
    }
    if (drag.current) { const e = pts[SEGMENTS - 1]; e.x = drag.current.x - drag.current.dx; e.y = drag.current.y - drag.current.dy; }
    pts[0].x = anchor.x; pts[0].y = anchor.y;
    for (let k = 0; k < 14; k++) {
      for (let i = 1; i < SEGMENTS; i++) {
        const a = pts[i - 1], b = pts[i];
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
        if (d <= step) continue;
        const f = (d - step) / d;
        const held = drag.current && i === SEGMENTS - 1;
        if (i === 1) { b.x -= dx * f; b.y -= dy * f; }
        else if (held) { a.x += dx * f; a.y += dy * f; }
        else { a.x += dx * f / 2; a.y += dy * f / 2; b.x -= dx * f / 2; b.y -= dy * f / 2; }
      }
    }
    paint();
  });

  const at = (e: React.PointerEvent) => {
    const r = root.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const c = tag.swatch;
  return (
    <div ref={root} className="relative h-[470px] w-full touch-pan-y select-none md:h-[640px]"
      onPointerMove={(e) => {
        const p = at(e), r = root.current!;
        pointer.current = { x: p.x / r.clientWidth, y: p.y / r.clientHeight };
        if (drag.current) { drag.current.x = p.x; drag.current.y = p.y; }
      }}
      onPointerLeave={() => { pointer.current = { x: 0.5, y: 0.3 }; }}>
      <svg className="pointer-events-none absolute inset-0 size-full overflow-visible" aria-hidden>
        <path ref={strap} fill="none" stroke="#1a1a18" strokeWidth="26" strokeLinecap="butt" />
        <path ref={strapText} id="lp-strap" fill="none" />
        <text fill="#f6f4ee" fontSize="10.500" fontWeight="600" letterSpacing="2.5" dy="3.500"><textPath href="#lp-strap" startOffset="6">TAGAWALLET  ·  TAGAWALLET  ·  TAGAWALLET  ·  TAGAWALLET  ·  TAGAWALLET</textPath></text>
      </svg>
      <span ref={clip} className="pointer-events-none absolute left-0 top-0 z-20 h-5 w-9 rounded-md border border-black/30 shadow-md" style={{ background: "linear-gradient(180deg,#d9d6cd,#8d8a80)" }} aria-hidden />
      <div ref={card}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          const p = at(e), end = rope.current[SEGMENTS - 1];
          drag.current = { dx: p.x - end.x, dy: p.y - end.y, x: p.x, y: p.y };
          setDragged(true);
        }}
        onPointerMove={(e) => { if (drag.current) { const p = at(e); drag.current.x = p.x; drag.current.y = p.y; } }}
        onLostPointerCapture={() => { drag.current = null; }}
        className="absolute left-0 top-0 z-10 w-[240px] cursor-grab touch-none will-change-transform active:cursor-grabbing md:w-[310px]" style={{ transform: "translate(-999px,0)" }}>
        <div className="relative flex aspect-[3/4.3] flex-col overflow-hidden rounded-[1.75rem] p-5 shadow-[0_34px_70px_-22px_rgba(0,0,0,.55)] transition-colors duration-500 md:p-7" style={{ background: c.bg, color: c.fg, border: c.id === "cream" ? "1px solid #dfdbcf" : undefined }}>
          <span className="mx-auto h-3 w-12 shrink-0 rounded-full bg-black/25" aria-hidden />
          <Identicon seed={tag.address || "x"} fg={c.fg} className="mt-5 size-16 md:mt-7 md:size-24" />
          <p key={tag.name} className="pop mt-auto line-clamp-3 break-words text-3xl font-semibold leading-[1.02] tracking-tight md:text-[2.6rem]">{tag.name || "Name it"}</p>
          <p className="addr mt-3 truncate text-sm md:text-base">{tag.short}</p>
          <p className="mt-1 flex items-center justify-between gap-2 text-xs" style={{ color: c.sub }}>
            <span className="truncate">{tag.valid ? tag.chain : "Not an address yet"}</span>
            <span className="shrink-0">Only you</span>
          </p>
          <span className={`pointer-events-none absolute right-4 top-4 rounded-full bg-black/25 px-2 py-0.5 text-[11px] font-medium text-white transition-opacity duration-300 ${dragged ? "opacity-0" : "opacity-100"}`} aria-hidden>Drag me</span>
          {/* Foil that slides with the card's angle. */}
          <div ref={shine} aria-hidden className="pointer-events-none absolute inset-0 opacity-50 mix-blend-soft-light" style={{ backgroundImage: "linear-gradient(115deg, transparent 28%, rgba(255,255,255,.75) 44%, rgba(255,214,170,.55) 50%, rgba(255,255,255,.75) 56%, transparent 72%)", backgroundSize: "260% 260%", backgroundPosition: "50% 50%" }} />
        </div>
      </div>
    </div>
  );
}

function Maker({ address, setAddress, name, setName, swatch, setSwatch, tag, poke, signedIn }: {
  address: string; setAddress: (v: string) => void; name: string; setName: (v: string) => void; swatch: Swatch; setSwatch: (s: Swatch) => void; tag: Tag; poke: () => void; signedIn: boolean;
}) {
  const [sample, setSample] = useState(0);
  return (
    <div className="mt-7 rounded-2xl border border-line bg-card p-4 shadow-xl md:p-5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor="y-address" className="text-sm font-medium">Paste any address</label>
        <button type="button" className="text-xs text-accent hover:underline" onClick={() => { const n = (sample + 1) % SAMPLES.length; setSample(n); setAddress(SAMPLES[n].address); setName(SAMPLES[n].name); poke(); }}>Try another chain</button>
      </div>
      <input id="y-address" value={address} spellCheck={false} autoComplete="off" onChange={(e) => { setAddress(e.target.value); poke(); }} placeholder="0x…, bc1…, or name.eth" aria-describedby="y-status" className="addr mt-1.5 w-full rounded-lg border border-line bg-paper px-3 py-2.5" />
      <p id="y-status" aria-live="polite" className={`mt-1.5 flex min-h-5 items-center gap-1.5 text-xs ${tag.valid ? "text-good" : "text-muted"}`}>
        {tag.valid ? <><span aria-hidden>✓</span> Recognized: {tag.chain}</> : address.trim() ? "That doesn't look like an address yet." : "Ethereum, Base, Solana, Bitcoin and more."}
      </p>
      <label htmlFor="y-name" className="mt-3 block text-sm font-medium">Call it anything</label>
      <input id="y-name" value={name} maxLength={32} autoComplete="off" onChange={(e) => { setName(e.target.value); poke(); }} placeholder="Alice, OTC desk" className="mt-1.5 w-full rounded-lg border border-line bg-paper px-3 py-2.5" />
      <div className="mt-4 flex items-center justify-between gap-3">
        <div role="radiogroup" aria-label="Tag color" className="flex gap-1.5">
          {SWATCHES.map((s) => (
            <button key={s.id} type="button" role="radio" aria-checked={swatch.id === s.id} aria-label={s.id} onClick={() => { setSwatch(s); poke(); }}
              className={`size-7 rounded-full border border-[var(--muted)]/50 transition-transform duration-200 hover:scale-110 ${swatch.id === s.id ? "ring-2 ring-accent ring-offset-2 ring-offset-card" : ""}`} style={{ background: s.bg }} />
          ))}
        </div>
        <Link href={signedIn ? "/dashboard" : "/signup"} className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg bg-accent px-4 py-2.5 font-medium text-accent-ink transition-transform duration-200 hover:scale-[1.03] active:scale-95">
          {signedIn ? "Open dashboard" : "Save it for real"}<span className="cta-arrow" aria-hidden>→</span>
        </Link>
      </div>
    </div>
  );
}

/* ---------- Your tag travels across the web ---------- */

function TagChip({ tag, className = "", slot }: { tag: Tag; className?: string; slot?: boolean }) {
  const c = tag.swatch;
  return (
    <span {...(slot ? { "data-slot": true } : {})} className={`inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-l-full rounded-r-lg py-1 pl-1.5 pr-2.5 align-middle text-sm font-semibold shadow-md ${slot ? "invisible" : ""} ${className}`} style={{ background: c.bg, color: c.fg, border: c.id === "cream" ? "1px solid #dfdbcf" : undefined }}>
      <Identicon seed={tag.address || "x"} fg={c.fg} className="size-4 shrink-0" />
      <span className="truncate">{tag.name || "Name it"}</span>
    </span>
  );
}

const TRAVEL = [
  { id: "Explorer", title: "On the explorer.", body: "Right next to the address, on the pages you enable." },
  { id: "X", title: "In your feed.", body: "When someone posts that address, you see your name for it." },
  { id: "Trading", title: "In your trading tools.", body: "Top traders stop being strangers." },
  { id: "Your list", title: "And in one place.", body: "Add every wallet they own, across chains, with the links that back it up." },
];

function Scene({ i, tag, live }: { i: number; tag: Tag; live?: boolean }) {
  const slot = !live;
  if (i === 0) return (
    <div className="divide-y divide-line text-sm">
      <div className="flex justify-between gap-3 px-5 py-4 text-xs text-muted"><span>From</span><span>Value</span></div>
      {[["0x71C7…976F", "88.0 ETH"], [null, "310.2 ETH"], ["0xFABB…8e4c", "12.0 ETH"], ["0x2c7a…E3b1", "0.4 ETH"]].map(([a, v], k) => (
        <div key={k} className="flex items-center justify-between gap-3 px-5 py-4">
          {a ? <span className="addr text-muted">{a}</span> : <TagChip tag={tag} slot={slot} />}
          <span className="text-xs text-muted">{v}</span>
        </div>
      ))}
    </div>
  );
  if (i === 1) return (
    <div className="space-y-5 p-5 md:p-7">
      <div className="flex gap-3">
        <span className="size-10 shrink-0 rounded-full bg-wash" aria-hidden />
        <p className="text-base leading-relaxed md:text-lg"><span className="font-semibold">@onchain_notes</span> <span className="text-muted">· 4m</span><br />Big move this morning. Funds went straight to <TagChip tag={tag} slot={slot} />. Does anyone know who that is?</p>
      </div>
      <div className="flex gap-3">
        <span className="size-10 shrink-0 rounded-full bg-wash" aria-hidden />
        <p className="text-base leading-relaxed text-muted md:text-lg"><span className="font-semibold text-ink">@ledger_lore</span> · 11m<br />Same counterparty as last week.</p>
      </div>
    </div>
  );
  if (i === 2) return (
    <div className="p-2 text-sm md:p-4">
      <div className="flex justify-between px-3 py-2 text-xs text-muted"><span>Top traders</span><span>Side</span></div>
      {[["0xFABB…8e4c", "Sell"], [null, "Buy"], ["0x71C7…976F", "Buy"], ["0x2c7a…E3b1", "Sell"]].map(([a, side], k) => (
        <div key={k} className={`flex items-center justify-between rounded-lg px-3 py-3.5 ${a ? "" : "bg-wash"}`}>
          {a ? <span className="addr text-muted">{a}</span> : <TagChip tag={tag} slot={slot} />}
          <span className={`text-xs font-medium ${side === "Buy" ? "text-good" : "text-bad"}`}>{side}</span>
        </div>
      ))}
    </div>
  );
  return (
    <div className="grid h-full gap-5 p-5 md:grid-cols-[auto_1fr] md:p-7">
      <div className="flex items-center gap-3 md:block">
        <Identicon seed={tag.address || "x"} fg="var(--ink)" className="size-12 md:size-20" />
        <div className="md:mt-3"><TagChip tag={tag} slot={slot} /><p className="mt-1 text-xs text-muted">Only you can see this</p></div>
      </div>
      <ul className="divide-y divide-line self-start rounded-xl border border-line text-sm">
        <li className="flex justify-between gap-3 px-4 py-3"><span className="addr truncate">{tag.short}</span><span className="truncate text-xs text-muted">{tag.chain || "Unknown"}</span></li>
        <li className="flex justify-between gap-3 px-4 py-3"><span className="addr">0x8Ba1…BA72</span><span className="text-xs text-muted">Base</span></li>
        <li className="flex justify-between gap-3 px-4 py-3"><span className="addr">7xKX…gAsU</span><span className="text-xs text-muted">Solana</span></li>
        <li className="px-4 py-3 text-xs font-medium text-accent">+ Add another wallet</li>
      </ul>
    </div>
  );
}

function Travel({ tag }: { tag: Tag }) {
  const root = useRef<HTMLElement>(null);
  const field = useRef<HTMLDivElement>(null);
  const win = useRef<HTMLDivElement>(null);
  const scenes = useRef<(HTMLDivElement | null)[]>([]);
  const flyer = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);

  useSmoothProgress(root, (p) => {
    // The color field opens up from a rounded panel to the full screen.
    if (field.current) {
      const g = ease(seg(p, 0, 0.09));
      field.current.style.transform = `scale(${0.9 + g * 0.1})`;
      field.current.style.borderRadius = `${(1 - g) * 48}px`;
    }
    const n = TRAVEL.length;
    const from = Math.min(n - 1, Math.floor(p * n)), local = p * n - from;
    // Hold each page, then move in the last part of its scroll range.
    const k = from === n - 1 ? 0 : ease(seg(local, 0.58, 1));
    const to = Math.min(n - 1, from + 1);
    setStep(k > 0.5 ? to : from);
    scenes.current.forEach((el, i) => { if (el) el.style.opacity = String(i === from ? 1 - seg(k, 0, 0.55) : i === to ? seg(k, 0.45, 1) : 0); });
    const box = win.current?.getBoundingClientRect();
    if (!box || !flyer.current) return;
    const rect = (i: number) => scenes.current[i]?.querySelector("[data-slot]")?.getBoundingClientRect();
    const a = rect(from), b = rect(to);
    if (!a || !b) return;
    const x = a.left + (b.left - a.left) * k - box.left, y = a.top + (b.top - a.top) * k - box.top;
    // A little hop between pages, so it reads as the same tag moving.
    const hop = Math.sin(k * Math.PI);
    flyer.current.style.transform = `translate(${x}px, ${y - hop * 42}px) scale(${1 + hop * 0.32}) rotate(${hop * -4}deg)`;
  });

  return (
    <section ref={root} className="h-[460vh]" aria-label="Your tag on the sites you use">
      <div className="sticky top-0 flex h-dvh flex-col items-center justify-center gap-5 overflow-hidden px-4 pt-14 md:gap-7" style={{ color: tag.swatch.fg }}>
        <div ref={field} aria-hidden className="absolute inset-0 transition-colors duration-500" style={{ background: tag.swatch.bg, transform: "scale(.9)", borderRadius: 48 }} />
        <div key={step} className="pop relative text-center">
          <h2 className="text-3xl font-semibold tracking-tight md:text-6xl">{TRAVEL[step].title}</h2>
          <p className="mx-auto mt-2 max-w-lg opacity-75 md:text-lg">{TRAVEL[step].body}</p>
        </div>
        <div ref={win} className="relative w-full max-w-4xl overflow-hidden rounded-2xl border border-line bg-card text-ink shadow-[0_40px_90px_-30px_rgba(0,0,0,.6)]">
          <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
            <span className="size-2.5 rounded-full bg-line" /><span className="size-2.5 rounded-full bg-line" /><span className="size-2.5 rounded-full bg-line" />
            <div className="ml-2 flex gap-1 text-xs">
              {TRAVEL.map((t, i) => <span key={t.id} className={`rounded-md px-2 py-1 font-medium transition-colors duration-300 ${step === i ? "bg-wash text-ink" : "text-muted"}`}>{t.id}</span>)}
            </div>
          </div>
          <div className="relative h-[310px] md:h-[340px]">
            {TRAVEL.map((t, i) => <div key={t.id} ref={(el) => { scenes.current[i] = el; }} className="absolute inset-0 transition-none" style={{ opacity: i === 0 ? 1 : 0 }}><Scene i={i} tag={tag} /></div>)}
          </div>
          <div ref={flyer} className="absolute left-0 top-0 z-10 origin-left will-change-transform"><TagChip tag={tag} /></div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Who can see it ---------- */

const AUDIENCE = [
  { id: "me", label: "Just me", line: "Nobody else can see it. There is no public feed of what you're researching.", people: ["You"] },
  { id: "team", label: "My team", line: "Invite people to a shared list, and it shows up on their pages too, marked as shared.", people: ["You", "M", "T", "R"] },
  { id: "public", label: "Public profile", line: "Only entities can go public, and only after verification, so a claim never looks like a fact.", people: ["You", "M", "T", "R", "+"] },
];

function Audience({ tag }: { tag: Tag }) {
  const [i, setI] = useState(0);
  const a = AUDIENCE[i];
  return (
    <section className="mx-auto w-full max-w-4xl px-5 py-24 text-center md:py-36">
      <h2 className="text-[clamp(2.25rem,6vw,5rem)] font-semibold leading-[1.25] tracking-[-0.03em]">Who gets to see <span data-rope-slot className="whitespace-nowrap rounded-l-full rounded-r-2xl px-[.35em]" style={{ background: tag.swatch.bg, color: tag.swatch.fg }}>{tag.name || "it"}</span>?</h2>
      <p className="mt-4 text-xl font-medium text-accent md:text-2xl">You decide.</p>
      <div role="radiogroup" aria-label="Visibility" className="mx-auto mt-9 inline-flex rounded-full border border-line bg-card p-1 shadow-md">
        {AUDIENCE.map((x, k) => (
          <button key={x.id} type="button" role="radio" aria-checked={i === k} onClick={() => setI(k)} className={`rounded-full px-3.5 py-2 text-sm font-medium transition-colors duration-200 md:px-5 ${i === k ? "bg-ink text-paper" : "text-muted hover:text-ink"}`}>{x.label}</button>
        ))}
      </div>
      <div className="mt-8 flex h-14 items-center justify-center" aria-hidden>
        {AUDIENCE[2].people.map((p, k) => {
          const on = k < a.people.length;
          return <span key={p} className="-mx-1 grid size-12 place-items-center rounded-full border-2 border-paper bg-wash text-xs font-semibold transition-all duration-500 ease-[cubic-bezier(.3,1.5,.5,1)]" style={{ transform: on ? "scale(1)" : "scale(0)", opacity: on ? 1 : 0, transitionDelay: `${k * 45}ms`, background: k === 0 ? "var(--accent)" : undefined, color: k === 0 ? "var(--accent-ink)" : undefined }}>{p}</span>;
        })}
      </div>
      <p key={a.id} className="pop mx-auto mt-5 max-w-lg text-muted md:text-lg">{a.line}</p>
    </section>
  );
}

/* ---------- Footer takes the color and name you chose ---------- */

function Footer({ tag, signedIn }: { tag: Tag; signedIn: boolean }) {
  const c = tag.swatch;
  return (
    <footer className="overflow-hidden transition-colors duration-700" style={{ background: c.bg, color: c.fg }}>
      <div className="mx-auto w-full max-w-7xl px-5 pb-8 pt-20 md:px-8 md:pt-28">
        <BrandMark size={84} className={c.id === "orange" ? "brightness-[.3]" : ""} />
        <p className="mt-7 max-w-5xl break-words text-[clamp(2.75rem,8.5vw,8rem)] font-semibold leading-[.98] tracking-[-0.035em]">Keep &ldquo;{tag.name || "this one"}&rdquo;.</p>
        <Link href={signedIn ? "/dashboard" : "/signup"} className="mt-8 inline-flex items-center gap-2 rounded-full px-7 py-4 text-lg font-medium transition-transform duration-200 hover:scale-[1.04] active:scale-95" style={{ background: c.fg, color: c.bg }}>
          {signedIn ? "Open dashboard" : "Start tagging, it's free"}<span className="cta-arrow" aria-hidden>→</span>
        </Link>
        <p className="mt-4 text-sm" style={{ color: c.sub }}>What you typed stayed on this page. Nothing was sent or saved.</p>
        <p className="mt-16 max-w-2xl text-sm" style={{ color: c.sub }}>TagAWallet is not a wallet. It holds no funds and will never ask for your seed phrase, private key or a transaction signature.</p>
        <div className="mt-5 flex flex-wrap justify-between gap-4 pb-14 text-sm font-medium md:pb-2">
          <span>© {new Date().getFullYear()} TagAWallet</span>
          <span className="flex gap-5"><Link href="/privacy" className="hover:underline">Privacy</Link><Link href="/terms" className="hover:underline">Terms</Link></span>
        </div>
      </div>
    </footer>
  );
}

function useTagMaker() {
  const [address, setAddress] = useState(SAMPLES[0].address);
  const [name, setName] = useState(SAMPLES[0].name);
  const [swatch, setSwatch] = useState(SWATCHES[0]);
  const [jiggle, setJiggle] = useState(0);
  const tag: Tag = useMemo(() => ({ address, name, swatch, ...describe(address) }), [address, name, swatch]);
  const poke = () => setJiggle((v) => v + 1);
  return { address, setAddress, name, setName, swatch, setSwatch, jiggle, tag, poke };
}

function YoursHero({ m, signedIn }: { m: ReturnType<typeof useTagMaker>; signedIn: boolean }) {
  const { address, setAddress, name, setName, swatch, setSwatch, jiggle, tag, poke } = m;
  return (
    <section className="mx-auto grid min-h-dvh w-full max-w-6xl items-center gap-2 overflow-x-clip px-5 pb-16 pt-24 md:grid-cols-[1.05fr_1fr] md:gap-8 md:pt-16">
          <div className="order-2 md:order-1">
            <h1 className="rise text-[clamp(2.75rem,6.4vw,5.75rem)] font-semibold leading-[.98] tracking-[-0.035em]">Know who&apos;s behind every wallet.</h1>
            <p className="rise mt-4 max-w-lg text-muted md:text-lg" style={{ "--d": "100ms" } as React.CSSProperties}>Privately tag addresses, link socials, group related wallets, and recognize identities wherever you research and trade. Try it right here.</p>
            <div className="rise" style={{ "--d": "200ms" } as React.CSSProperties}>
              <Maker address={address} setAddress={setAddress} name={name} setName={setName} swatch={swatch} setSwatch={setSwatch} tag={tag} poke={poke} signedIn={signedIn} />
            </div>
          </div>
          <div className="order-1 -mt-24 md:order-2 md:-mt-16"><Lanyard tag={tag} jiggle={jiggle} /></div>
        </section>
  );
}

export function YoursLanding({ signedIn }: { signedIn: boolean }) {
  const m = useTagMaker();
  const { tag } = m;
  return (
    <>
      <PillNav signedIn={signedIn} />
      <main>
        <YoursHero m={m} signedIn={signedIn} />
        <Travel tag={tag} />
        <Audience tag={tag} />
      </main>
      <Footer tag={tag} signedIn={signedIn} />
    </>
  );
}

export { useTagMaker, YoursHero, Travel as YoursTravel, Audience as YoursAudience, Footer as YoursFooter };
export { Maker, Scene, TRAVEL, TagChip, Identicon, SWATCHES };
export type { Tag };
