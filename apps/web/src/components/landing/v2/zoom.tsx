"use client";
import { useRef, useState } from "react";
import { CHAINS, Chip, Cta, FootLinks, NOT_A_WALLET, Nav, POINTS, Reveal, SAMPLE_TAGS, ScrollWords, ease, fakeAddr, seg, useScrollProgress } from "../shared";

function Tile({ seed }: { seed: number }) {
  const tag = (k: number) => SAMPLE_TAGS[(seed * 3 + k) % SAMPLE_TAGS.length];
  const kind = seed % 3;
  const a = tag(0), b = tag(2);
  return (
    <div className="w-72 rounded-xl border border-line bg-card p-3.5 text-xs shadow-sm">
      <p className="mb-2.5 text-[11px] text-muted">{["Explorer", "X", "Trading"][kind]}</p>
      {kind === 0 && (
        <div className="space-y-2">
          <p className="flex items-center gap-2"><span className="addr truncate">{fakeAddr(seed)}</span><Chip name={a.name} tone={a.tone} /></p>
          <p className="flex items-center gap-2"><span className="addr truncate">{fakeAddr(seed + 9)}</span><Chip name={b.name} tone={b.tone} /></p>
          <p className="addr text-muted">{fakeAddr(seed + 21)}</p>
        </div>
      )}
      {kind === 1 && <p className="leading-relaxed">Anyone know who moved funds from <Chip name={a.name} tone={a.tone} /> this morning? Same pattern as <span className="addr">{fakeAddr(seed + 3)}</span>.</p>}
      {kind === 2 && (
        <div className="space-y-2">
          <p className="flex items-center justify-between gap-2"><Chip name={a.name} tone={a.tone} /><span className="text-good">Buy</span></p>
          <p className="flex items-center justify-between gap-2"><Chip name={b.name} tone={b.tone} /><span className="text-bad">Sell</span></p>
        </div>
      )}
    </div>
  );
}

const COLUMNS = [0, 1, 2, 3, 4, 5, 6];
const ROWS: { addr: string; name: string; source: string; tone: "mine" | "good" | "warn"; at: number; caption: string }[] = [
  { addr: "0x7a25…488D", name: "Alice, OTC desk", source: "Your private tag", tone: "mine", at: 0.56, caption: "Your notes, on the page." },
  { addr: "0x1f98…F984", name: "DAO treasury", source: "Shared by Research", tone: "warn", at: 0.68, caption: "Your team's research, too." },
  { addr: "0x28C6…1d60", name: "Exchange hot wallet", source: "Verified", tone: "good", at: 0.8, caption: "And what's actually verified." },
];

function ZoomStage({ signedIn }: { signedIn: boolean }) {
  const root = useRef<HTMLElement>(null);
  const wall = useRef<HTMLDivElement>(null);
  const head = useRef<HTMLDivElement>(null);
  const page = useRef<HTMLDivElement>(null);
  const [p, setP] = useState(0);

  useScrollProgress(root, (v) => {
    setP(v);
    const k = ease(seg(v, 0.04, 0.5));
    if (wall.current) {
      wall.current.style.transform = `translate(-50%, -50%) perspective(1600px) rotateX(${(1 - k) * 42}deg) rotateZ(${(1 - k) * -18}deg) scale(${1 + k * 1.7})`;
      wall.current.style.opacity = String(1 - seg(v, 0.3, 0.5));
    }
    if (head.current) {
      const h = 1 - seg(v, 0, 0.14);
      head.current.style.opacity = String(h);
      head.current.style.transform = `translateY(${-(1 - h) * 40}px)`;
      head.current.style.visibility = h <= 0 ? "hidden" : "visible";
    }
    if (page.current) {
      const e = ease(seg(v, 0.2, 0.5));
      page.current.style.opacity = String(seg(v, 0.2, 0.34));
      page.current.style.transform = `scale(${0.45 + e * 0.55})`;
    }
  });

  const caption = [...ROWS].reverse().find((r) => p >= r.at)?.caption;
  return (
    <section ref={root} className="h-[420vh]" aria-label="From every site you use to one tagged page">
      <div className="sticky top-0 grid h-dvh place-items-center overflow-hidden">
        <div ref={wall} aria-hidden className="absolute left-1/2 top-1/2 flex gap-4 will-change-transform" style={{ transform: "translate(-50%, -50%) perspective(1600px) rotateX(42deg) rotateZ(-18deg)" }}>
          {COLUMNS.map((c) => (
            <div key={c} className="drift-up flex flex-col gap-4" style={{ "--t": `${46 + c * 9}s`, animationDirection: c % 2 ? "reverse" : "normal" } as React.CSSProperties}>
              {[...Array(14)].map((_, i) => <Tile key={i} seed={c * 7 + (i % 7)} />)}
            </div>
          ))}
        </div>
        <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse 62% 56% at 50% 48%, var(--paper) 42%, color-mix(in srgb, var(--paper) 55%, transparent) 72%, color-mix(in srgb, var(--paper) 10%, transparent))", opacity: 1 - seg(p, 0.1, 0.3) }} aria-hidden />
        <div ref={head} className="relative z-10 flex flex-col items-center px-5 text-center">
          <h1 className="rise max-w-4xl text-5xl font-semibold leading-[1] tracking-tight md:text-8xl">Know who&apos;s behind every wallet.</h1>
          <p className="rise mt-5 max-w-xl text-muted md:text-lg" style={{ "--d": "120ms" } as React.CSSProperties}>Privately tag addresses, link socials, group related wallets, and recognize identities wherever you research and trade.</p>
          <div className="rise mt-6" style={{ "--d": "200ms" } as React.CSSProperties}><Cta signedIn={signedIn} /></div>
        </div>
        <div ref={page} className="absolute z-10 w-[min(92vw,860px)] opacity-0 will-change-transform">
          <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-2xl">
            <div className="flex items-center gap-2 border-b border-line px-4 py-3 text-xs text-muted">
              <span className="size-2.5 rounded-full bg-line" /><span className="size-2.5 rounded-full bg-line" /><span className="size-2.5 rounded-full bg-line" />
              <span className="ml-2">an explorer you already use</span>
            </div>
            <ul className="divide-y divide-line">
              {ROWS.map((r) => (
                <li key={r.addr} className="flex min-h-20 flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4 md:min-h-24 md:px-8">
                  <span className="addr text-lg md:text-2xl">{r.addr}</span>
                  {p >= r.at && <span className="pop"><Chip className="px-2.5 py-1 text-sm md:text-base" name={r.name} source={r.source} tone={r.tone} /></span>}
                </li>
              ))}
            </ul>
          </div>
          <p key={caption} className="pop mt-6 min-h-10 text-center text-2xl font-semibold tracking-tight md:text-4xl">{caption}</p>
        </div>
      </div>
    </section>
  );
}

// Addresses as a repeating image, used as the fill of the footer wordmark.
const FILL = (() => {
  const lines = [0, 1, 2, 3, 4, 5].map((r) => `<text x="${-40 + r * 30}" y="${14 + r * 17}">${[0, 1, 2, 3, 4, 5, 6].map((c) => fakeAddr(r * 7 + c).replace("…", "")).join("  ")}</text>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="102"><style>text{font:700 14px monospace;fill:#EE6A42}</style>${lines}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
})();

function AddressWordmark() {
  return (
    <p role="img" aria-label="TagAWallet" className="addr-fill whitespace-nowrap text-center text-[17vw] font-bold leading-[1.05] tracking-tighter"
      style={{ fontFamily: "var(--font-sans)", backgroundImage: FILL, backgroundColor: "color-mix(in srgb, #EE6A42 30%, transparent)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>TagAWallet</p>
  );
}

export function ZoomLanding({ signedIn }: { signedIn: boolean }) {
  return (
    <>
      <Nav signedIn={signedIn} />
      <main>
        <ZoomStage signedIn={signedIn} />
        <section className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-20 md:grid-cols-4 md:gap-6">
          {POINTS.map((p, i) => (
            <Reveal key={p.title} delay={i * 80} className="border-t border-line pt-4">
              <h2 className="font-semibold">{p.title}</h2>
              <p className="mt-2 text-sm text-muted">{p.body}</p>
            </Reveal>
          ))}
        </section>
        <section className="mx-auto w-full max-w-5xl px-4 py-24">
          <ScrollWords text={NOT_A_WALLET} className="text-3xl font-semibold leading-tight tracking-tight md:text-5xl" />
        </section>
      </main>
      <footer className="overflow-hidden border-t border-line pt-14">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-end justify-between gap-6 px-4">
          <div>
            <p className="text-3xl font-semibold tracking-tight md:text-5xl">Every address is someone.</p>
            <Cta signedIn={signedIn} className="mt-4" />
          </div>
          <div className="text-sm text-muted">
            <p>{CHAINS.join(" · ")}</p>
            <FootLinks className="mt-2" />
          </div>
        </div>
        <div className="mt-8 pb-14 md:pb-2"><AddressWordmark /></div>
      </footer>
    </>
  );
}
