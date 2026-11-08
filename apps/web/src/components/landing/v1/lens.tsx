"use client";
import { useRef, useState } from "react";
import { CHAINS, Chip, Cta, FootLinks, NOT_A_WALLET, Nav, POINTS, ProximityWordmark, Reveal, SAMPLE_TAGS, ScrollWords, fakeAddr, seg, useFrame, useScrollProgress, type Tone } from "../shared";

const COLS = 7, ROWS = 24;
const CELLS = Array.from({ length: COLS * ROWS }, (_, i) => ({ addr: fakeAddr(i), tag: SAMPLE_TAGS[(i * 5 + (i % 3)) % SAMPLE_TAGS.length] }));
const GRID = { gridTemplateColumns: `repeat(${COLS}, 190px)`, gridAutoRows: "46px" };

function LensHero({ signedIn }: { signedIn: boolean }) {
  const root = useRef<HTMLElement>(null);
  const reveal = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const s = useRef({ x: 0, y: 0, tx: 0, ty: 0, lastMove: -10 });

  useFrame(root, (dt, t) => {
    const el = root.current, c = s.current;
    if (!el) return;
    const w = el.clientWidth, h = el.clientHeight;
    // Wander on its own until the visitor takes over.
    if (t - c.lastMove > 2.5) {
      c.tx = w * (0.5 + 0.36 * Math.sin(t * 0.5));
      c.ty = h * (0.78 + 0.14 * Math.sin(t * 0.83));
    }
    const k = 1 - Math.pow(0.0015, dt);
    c.x += (c.tx - c.x) * k;
    c.y += (c.ty - c.y) * k;
    const r = Math.min(190, w * 0.3);
    reveal.current?.style.setProperty("mask-image", `radial-gradient(circle ${r}px at ${c.x}px ${c.y}px, #000 96%, transparent 100%)`);
    if (ring.current) { ring.current.style.transform = `translate(${c.x - r}px, ${c.y - r}px)`; ring.current.style.width = ring.current.style.height = `${r * 2}px`; }
  });

  const move = (e: React.PointerEvent) => {
    const r = root.current!.getBoundingClientRect();
    s.current.tx = e.clientX - r.left;
    s.current.ty = e.clientY - r.top;
    s.current.lastMove = performance.now() / 1000;
  };

  return (
    <section ref={root} onPointerMove={move} onPointerDown={move} className="relative h-dvh min-h-[640px] touch-pan-y overflow-hidden">
      <div className="absolute inset-0 grid justify-center pt-16" style={GRID} aria-hidden>
        {CELLS.map((c, i) => <span key={i} className="addr flex items-center justify-center text-muted/45">{c.addr}</span>)}
      </div>
      {/* Same grid, labelled, visible only inside the lens. */}
      <div ref={reveal} className="absolute inset-0 grid justify-center bg-card pt-16" style={{ ...GRID, maskImage: "radial-gradient(circle 0 at 50% 50%, #000, transparent)" }} aria-hidden>
        {CELLS.map((c, i) => <span key={i} className="flex items-center justify-center"><Chip name={c.tag.name} source={c.tag.source} tone={c.tag.tone} /></span>)}
      </div>
      <div ref={ring} className="pointer-events-none absolute left-0 top-0 rounded-full border-2 border-accent shadow-[0_0_60px_-10px_var(--accent)]" aria-hidden />
      <div className="pointer-events-none absolute inset-x-0 top-20 flex justify-center px-4 md:top-24">
        <div className="pointer-events-auto max-w-xl rounded-2xl border border-line bg-paper/90 p-5 text-center shadow-xl backdrop-blur-md md:p-7">
          <h1 className="text-4xl font-semibold leading-[1.05] tracking-tight md:text-5xl">Know who&apos;s behind every wallet.</h1>
          <p className="mx-auto mt-3 max-w-lg text-muted">Privately tag addresses, link socials, group related wallets, and recognize identities wherever you research and trade.</p>
          <Cta signedIn={signedIn} className="mt-5" />
        </div>
      </div>
    </section>
  );
}

const ROW_DATA: { addr: string; value: string; name: string; source: string; tone: Tone; title: string; body: string }[] = [
  { addr: "0x7a25…488D", value: "88.0 ETH", name: "Alice, OTC desk", source: "Your private tag", tone: "mine", title: "Your notes stay yours", body: "Tag any address in a click. Nobody else sees it until you invite them." },
  { addr: "0x1f98…F984", value: "310.2 ETH", name: "DAO treasury", source: "Shared by Research", tone: "warn", title: "Share with your team", body: "Shared lists bring your group's research onto the same pages." },
  { addr: "0x28C6…1d60", value: "1,204.5 ETH", name: "Exchange hot wallet", source: "Verified", tone: "good", title: "Trust what's verified", body: "Verified profiles are clearly marked, so a claim never looks like a fact." },
  { addr: "0xdEAD…bEEF", value: "0.4 ETH", name: "Bob, market maker", source: "Your private tag", tone: "mine", title: "Name what you just found", body: "Spot something new? Tag it right there on the page, then move on." },
];

function PinnedExplorer() {
  const root = useRef<HTMLElement>(null);
  const [step, setStep] = useState(0);
  const [typed, setTyped] = useState(0);
  useScrollProgress(root, (p) => {
    setStep(Math.min(3, Math.floor(p * 4)));
    setTyped(Math.round(seg(p, 0.76, 0.92) * ROW_DATA[3].name.length));
  });
  const current = ROW_DATA[step];
  return (
    <section ref={root} className="h-[360vh]" aria-label="How labels appear on the pages you use">
      <div className="sticky top-0 flex h-dvh items-center">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-8 px-4 md:grid-cols-[1fr_1.5fr]">
          <div key={step} className="pop">
            <p className="addr text-accent">0{step + 1} / 04</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">{current.title}</h2>
            <p className="mt-3 max-w-sm text-muted md:text-lg">{current.body}</p>
          </div>
          <div className="overflow-hidden rounded-xl border border-line bg-card">
            <div className="flex items-center gap-2 border-b border-line px-4 py-2.5 text-xs text-muted">
              <span className="size-2.5 rounded-full bg-line" /><span className="size-2.5 rounded-full bg-line" /><span className="size-2.5 rounded-full bg-line" />
              <span className="ml-2">an explorer you already use</span>
            </div>
            <ul className="divide-y divide-line text-sm">
              {ROW_DATA.map((r, i) => (
                <li key={r.addr} className={`flex min-h-16 flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 transition-colors duration-300 ${i === step ? "bg-wash" : ""}`}>
                  <span className="addr">{r.addr}</span>
                  {i === 3 ? (
                    step === 3 && typed > 0 ? <Chip name={r.name.slice(0, typed) + (typed < r.name.length ? "▏" : "")} source={typed === r.name.length ? r.source : undefined} tone={r.tone} /> : <span className="rounded-md border border-dashed border-line px-1.5 py-0.5 text-xs text-muted">Tag this wallet</span>
                  ) : i <= step && <Chip className="pop" name={r.name} source={r.source} tone={r.tone} />}
                  <span className="ml-auto text-xs text-muted">{r.value}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

export function LensLanding({ signedIn }: { signedIn: boolean }) {
  return (
    <>
      <Nav signedIn={signedIn} />
      <main>
        <LensHero signedIn={signedIn} />
        <PinnedExplorer />
        <section className="mx-auto grid w-full max-w-6xl gap-x-10 gap-y-10 px-4 py-20 sm:grid-cols-2">
          {POINTS.map((p, i) => (
            <Reveal key={p.title} delay={i * 70}>
              <h2 className="font-semibold">{p.title}</h2>
              <p className="mt-1.5 text-muted">{p.body}</p>
            </Reveal>
          ))}
        </section>
        <section className="overflow-hidden border-y border-line py-4" aria-label="Supported chains">
          <div className="marquee">
            {[...CHAINS, ...CHAINS, ...CHAINS, ...CHAINS].map((c, i) => <span key={i} className="px-6 font-medium text-muted">{c}</span>)}
          </div>
        </section>
        <section className="mx-auto w-full max-w-5xl px-4 py-32">
          <ScrollWords text={NOT_A_WALLET} className="text-3xl font-semibold leading-tight tracking-tight md:text-5xl" />
        </section>
      </main>
      <footer className="overflow-hidden border-t border-line pt-14 pb-20">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-end justify-between gap-6 px-4 text-muted">
          <div>
            <p className="text-2xl font-semibold tracking-tight text-ink">Give every address a name.</p>
            <Cta signedIn={signedIn} className="mt-4" />
          </div>
          <FootLinks />
        </div>
        <ProximityWordmark className="mt-10 text-[17vw]" />
      </footer>
    </>
  );
}

export { LensHero, PinnedExplorer };
