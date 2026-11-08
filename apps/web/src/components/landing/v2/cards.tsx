"use client";
import { useEffect, useRef, useState } from "react";
import { BrandMark } from "@/components/brand-mark";
import { Chip, Cta, FootLinks, NOT_A_WALLET, Nav, POINTS, Reveal, clamp, ease, reducedMotion, seg, useFrame, useScrollProgress } from "../shared";

const IDENTITIES = [
  { name: "Exchange hot wallets", source: "Verified", wallets: 9, chains: "Ethereum · Base · BNB Chain", addr: "0x28C6…1d60", bg: "bg-good text-paper" },
  { name: "DAO treasury", source: "Shared by Research", wallets: 7, chains: "Ethereum · Arbitrum", addr: "0x1f98…F984", bg: "bg-warn text-paper" },
  { name: "Alice, OTC desk", source: "Your private tag", wallets: 4, chains: "Ethereum · Solana · Bitcoin", addr: "0x7a25…488D", bg: "bg-card text-ink border border-line" },
  { name: "My cold storage", source: "Your private tag", wallets: 2, chains: "Bitcoin · Ethereum", addr: "0x9C7E…c8F9", bg: "bg-accent text-accent-ink" },
];

function IdCard({ id, className = "", style }: { id: (typeof IDENTITIES)[number]; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`flex h-56 flex-col rounded-2xl p-5 shadow-lg ${id.bg} ${className}`} style={style}>
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-lg font-semibold leading-tight">{id.name}</p><p className="text-xs opacity-75">{id.source}</p></div>
        <span className="whitespace-nowrap text-xs font-medium opacity-80">{id.wallets} wallets</span>
      </div>
      <div className="mt-auto">
        <p className="addr text-lg">{id.addr}</p>
        <p className="mt-1 text-xs opacity-75">{id.chains}</p>
      </div>
    </div>
  );
}

function Clasp({ className = "" }: { className?: string }) {
  return (
    <div className={`absolute right-0 flex items-center rounded-l-full bg-paper py-3 pl-4 pr-6 shadow-inner ${className}`} aria-hidden>
      <span className="size-8 rounded-full bg-ink" />
    </div>
  );
}

function HeroWallet() {
  const root = useRef<HTMLDivElement>(null);
  const tilt = useRef<HTMLDivElement>(null);
  const [lifted, setLifted] = useState(3);
  const [held, setHeld] = useState(false);

  // Cards take turns rising until the visitor takes over.
  useEffect(() => {
    if (held || reducedMotion()) return;
    const id = setInterval(() => setLifted((v) => (v + IDENTITIES.length - 1) % IDENTITIES.length), 2200);
    return () => clearInterval(id);
  }, [held]);

  const c = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  useFrame(root, (dt) => {
    const k = 1 - Math.pow(0.003, dt);
    c.current.x += (c.current.tx - c.current.x) * k;
    c.current.y += (c.current.ty - c.current.y) * k;
    if (tilt.current) tilt.current.style.transform = `perspective(1100px) rotateY(${c.current.x * 9}deg) rotateX(${-c.current.y * 7}deg)`;
  });

  return (
    <div ref={root} className="relative h-[470px] w-full max-w-md justify-self-center md:h-[540px]"
      onPointerMove={(e) => {
        const r = root.current!.getBoundingClientRect();
        c.current.tx = clamp((e.clientX - r.left) / r.width - 0.5, -0.6, 0.6) * 2;
        c.current.ty = clamp((e.clientY - r.top) / r.height - 0.5, -0.6, 0.6) * 2;
      }}
      onPointerLeave={() => { c.current.tx = c.current.ty = 0; setHeld(false); }}>
      <div ref={tilt} className="absolute inset-0 will-change-transform" style={{ transformStyle: "preserve-3d" }}>
        {IDENTITIES.map((id, i) => {
          const base = 40 + i * 58, up = lifted === i;
          return (
            <button key={id.name} type="button" aria-label={`${id.name}, ${id.source}, ${id.wallets} wallets`}
              onPointerEnter={() => { setHeld(true); setLifted(i); }} onFocus={() => { setHeld(true); setLifted(i); }}
              className="absolute inset-x-3 block text-left transition-transform duration-500 ease-[cubic-bezier(.2,1,.3,1)]"
              style={{ top: base, zIndex: i, transform: `translateY(${up ? -34 : 0}px) rotate(${up ? 0 : (i - 1.5) * 0.7}deg)` }}>
              <IdCard id={id} />
            </button>
          );
        })}
        {/* The pocket the cards sit in. */}
        <div className="absolute inset-x-0 bottom-0 h-44 rounded-[1.75rem] bg-ink shadow-2xl md:h-52" style={{ zIndex: 10 }} aria-hidden>
          <Clasp className="top-12 md:top-16" />
          <div className="absolute bottom-5 left-6 text-paper"><BrandMark size={52} /></div>
        </div>
      </div>
    </div>
  );
}

const PANEL_STYLE = ["bg-card border border-line", "bg-accent text-accent-ink", "bg-ink text-paper", "bg-wash border border-line"];

function PanelVisual({ i }: { i: number }) {
  if (i === 0) return <div className="space-y-2"><Chip name="Only you" source="Research list" /><p className="text-sm opacity-70">No public feed. No followers. Nothing to leak.</p></div>;
  if (i === 1) return <div className="flex flex-col gap-1.5">{["0x7a25…488D · Ethereum", "0x7a25…488D · Base", "7xKX…gAsU · Solana", "bc1q…f3k9 · Bitcoin"].map((a) => <span key={a} className="addr w-fit rounded-md bg-black/15 px-2 py-1">{a}</span>)}</div>;
  if (i === 2) return <div className="flex flex-wrap gap-2 [&>span]:bg-paper"><Chip name="Alice" source="Your private tag" /><Chip name="Treasury" source="Shared" tone="warn" /><Chip name="Multisig" source="Self-claimed" tone="accent" /><Chip name="Exchange" source="Verified" tone="good" /></div>;
  return <p className="text-sm text-muted">Explorers · X · Trading tools you enable</p>;
}

function Stack() {
  const root = useRef<HTMLElement>(null);
  const panels = useRef<(HTMLElement | null)[]>([]);
  useScrollProgress(root, (p) => {
    const n = POINTS.length;
    panels.current.forEach((el, i) => {
      if (!el) return;
      const k = clamp(p * n - i - 0.4);
      el.style.transform = `scale(${1 - 0.05 * ease(k) * (i < n - 1 ? 1 : 0)})`;
    });
  });
  return (
    <section ref={root} className="mx-auto w-full max-w-5xl px-4 pb-16" aria-label="What's in your wallet of identities">
      {POINTS.map((p, i) => (
        <article key={p.title} ref={(el) => { panels.current[i] = el; }} className={`sticky mb-[12vh] flex min-h-[66dvh] origin-top flex-col justify-between gap-10 rounded-3xl p-8 shadow-xl md:p-12 ${PANEL_STYLE[i]}`} style={{ top: `${80 + i * 14}px` }}>
          <span className="addr opacity-60">0{i + 1}</span>
          <div className="grid items-end gap-8 md:grid-cols-[1.4fr_1fr]">
            <div>
              <h2 className="text-4xl font-semibold leading-[1.05] tracking-tight md:text-6xl">{p.title}</h2>
              <p className="mt-4 max-w-lg opacity-80 md:text-lg">{p.body}</p>
            </div>
            <PanelVisual i={i} />
          </div>
        </article>
      ))}
    </section>
  );
}

/** The footer is the wallet: cards slide up out of it as it arrives. */
function WalletFooter({ signedIn }: { signedIn: boolean }) {
  const root = useRef<HTMLElement>(null);
  const cards = useRef<(HTMLDivElement | null)[]>([]);
  useScrollProgress(root, (p) => {
    cards.current.forEach((el, i) => {
      if (!el) return;
      const k = ease(seg(p, 0.25 + i * 0.1, 0.65 + i * 0.1));
      el.style.transform = `translateY(${(1 - k) * 200}px) rotate(${(i - 1.5) * 4 * k}deg)`;
    });
  });
  return (
    <footer ref={root} className="relative overflow-hidden pt-36 md:pt-44">
      <div className="absolute inset-x-0 top-6 mx-auto flex max-w-5xl justify-center gap-0 px-4 md:top-8" aria-hidden>
        {IDENTITIES.map((id, i) => (
          <div key={id.name} ref={(el) => { cards.current[i] = el; }} className="-mx-8 w-52 shrink-0 md:-mx-4 md:w-80" style={{ transform: "translateY(200px)" }}><IdCard id={id} /></div>
        ))}
      </div>
      <div className="relative rounded-t-[2.5rem] bg-ink text-paper shadow-2xl">
        <Clasp className="top-16 hidden md:flex" />
        <div className="mx-auto w-full max-w-5xl px-6 pb-24 pt-14 md:pt-20">
          <p className="max-w-2xl text-5xl font-semibold leading-[1] tracking-tight md:text-7xl">Fill yours up.</p>
          <p className="mt-4 max-w-md opacity-70">{NOT_A_WALLET.split(". ")[1]}</p>
          <Cta signedIn={signedIn} className="mt-6" />
          <FootLinks className="mt-14 opacity-70" />
        </div>
      </div>
    </footer>
  );
}

export function CardsLanding({ signedIn }: { signedIn: boolean }) {
  return (
    <>
      <Nav signedIn={signedIn} />
      <main>
        <section className="mx-auto grid min-h-dvh w-full max-w-6xl items-center gap-10 px-4 pb-16 pt-24 md:grid-cols-[1.1fr_1fr]">
          <div>
            <h1 className="rise text-5xl font-semibold leading-[1] tracking-tight md:text-7xl">Know who&apos;s behind every wallet.</h1>
            <p className="rise mt-5 max-w-lg text-muted md:text-lg" style={{ "--d": "120ms" } as React.CSSProperties}>Privately tag addresses, link socials, group related wallets, and recognize identities wherever you research and trade.</p>
            <div className="rise mt-6" style={{ "--d": "200ms" } as React.CSSProperties}><Cta signedIn={signedIn} /></div>
            <p className="rise mt-5 text-xs text-muted" style={{ "--d": "280ms" } as React.CSSProperties}>A wallet for identities, not for money. It never holds funds.</p>
          </div>
          <HeroWallet />
        </section>
        <Stack />
        <section className="mx-auto w-full max-w-5xl px-4 pb-10"><Reveal><p className="max-w-2xl text-muted">{NOT_A_WALLET}</p></Reveal></section>
      </main>
      <WalletFooter signedIn={signedIn} />
    </>
  );
}
