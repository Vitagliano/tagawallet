"use client";
import { useRef, useState } from "react";
import { BrandMark } from "@/components/brand-mark";
import { CHAINS, Chip, Cta, FootLinks, NOT_A_WALLET, Nav, POINTS, Reveal, ease, seg, useFrame, useScrollProgress, type Tone } from "../shared";

type Party = { addr: string; name?: string; source?: string; tone?: Tone };
const ALICE: Party = { addr: "0x7a25…488D", name: "Alice, OTC desk", source: "Private", tone: "mine" };
const EXCHANGE: Party = { addr: "0x28C6…1d60", name: "Exchange hot wallet", source: "Verified", tone: "good" };
const DAO: Party = { addr: "0x1f98…F984", name: "DAO treasury", source: "Shared", tone: "warn" };
const MINE: Party = { addr: "0x5aAe…BeAed", name: "My cold storage", source: "Private", tone: "mine" };
const MM: Party = { addr: "0xC02a…6Cc2", name: "Market maker", source: "Shared", tone: "warn" };
const UNKNOWN: Party = { addr: "0xdEAD…bEEF" };

const TXS: { hash: string; from: Party; to: Party; value: string; age: string }[] = [
  { hash: "0x9f3c…a1e2", from: EXCHANGE, to: ALICE, value: "1,204.5 ETH", age: "2 min" },
  { hash: "0x41bd…77c0", from: ALICE, to: MM, value: "88.0 ETH", age: "9 min" },
  { hash: "0xe07a…03fd", from: DAO, to: UNKNOWN, value: "310.2 ETH", age: "14 min" },
  { hash: "0x6c12…9b4a", from: MINE, to: EXCHANGE, value: "12.0 ETH", age: "21 min" },
  { hash: "0xb8e5…10d7", from: UNKNOWN, to: DAO, value: "0.4 ETH", age: "33 min" },
  { hash: "0x27aa…c6f1", from: MM, to: EXCHANGE, value: "540.0 ETH", age: "48 min" },
];

const COLS = "grid grid-cols-[1fr_1fr] md:grid-cols-[0.9fr_1.5fr_1.5fr_0.9fr_0.6fr] items-center gap-3 px-4";

function PartyCell({ party, tagged }: { party: Party; tagged: boolean }) {
  if (!tagged) return <span className="addr truncate text-muted">{party.addr}</span>;
  if (party.name) return <span className="truncate"><Chip name={party.name} source={party.source} tone={party.tone} /></span>;
  return <span className="w-fit whitespace-nowrap rounded-md border border-dashed border-accent/60 px-1.5 py-0.5 text-xs font-medium text-accent">Tag this wallet</span>;
}

function Table({ tagged, myName }: { tagged: boolean; myName?: string }) {
  // A visitor-chosen name replaces the first wallet's label everywhere it appears.
  const own = (p: Party): Party => (myName !== undefined && p === ALICE ? { ...p, name: myName || "Name it", source: "Yours", tone: "accent" } : p);
  return (
    <div className="bg-card text-sm">
      <div className={`${COLS} border-b border-line py-2.5 text-xs font-medium text-muted`}>
        <span className="hidden md:block">Transaction</span><span>From</span><span>To</span><span className="hidden md:block">Value</span><span className="hidden md:block">Age</span>
      </div>
      {TXS.map((t) => (
        <div key={t.hash} className={`${COLS} h-[52px] border-b border-line last:border-0`}>
          <span className="addr hidden truncate text-muted md:block">{t.hash}</span>
          <PartyCell party={own(t.from)} tagged={tagged} />
          <PartyCell party={own(t.to)} tagged={tagged} />
          <span className="hidden whitespace-nowrap md:block">{t.value}</span>
          <span className="hidden whitespace-nowrap text-xs text-muted md:block">{t.age}</span>
        </div>
      ))}
    </div>
  );
}

function Wipe({ myName, reveal = false }: { myName?: string; reveal?: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const s = useRef({ x: 58, target: 58, touched: false });
  const [value, setValue] = useState(58);
  const apply = (x: number) => root.current?.style.setProperty("--w", `${x}%`);

  useFrame(root, (dt, t) => {
    const c = s.current;
    if (reveal) c.target = 100;
    else if (!c.touched) c.target = 50 + 34 * Math.sin(t * 0.55);
    c.x += (c.target - c.x) * (1 - Math.pow(0.001, dt));
    apply(c.x);
  });

  const move = (e: React.PointerEvent) => {
    const r = root.current!.getBoundingClientRect();
    s.current.touched = true;
    s.current.target = Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100));
    setValue(Math.round(s.current.target));
  };

  return (
    <div className="overflow-hidden rounded-xl border border-line shadow-2xl">
      <div className="flex items-center gap-2 border-b border-line bg-card px-4 py-2.5 text-xs text-muted">
        <span className="size-2.5 rounded-full bg-line" /><span className="size-2.5 rounded-full bg-line" /><span className="size-2.5 rounded-full bg-line" />
        <span className="ml-2">an explorer you already use</span>
      </div>
      <div ref={root} onPointerMove={move} onPointerDown={move} className="relative cursor-ew-resize touch-pan-y select-none" style={{ "--w": "58%" } as React.CSSProperties}>
        <div aria-label="An explorer page showing only raw addresses"><Table tagged={false} /></div>
        <div className="absolute inset-0" style={{ clipPath: "inset(0 calc(100% - var(--w)) 0 0)" }} aria-label="The same page with TagAWallet labels"><Table tagged myName={myName} /></div>
        <div className="pointer-events-none absolute inset-y-0 left-[var(--w)] w-0.5 -translate-x-1/2 bg-accent" aria-hidden>
          <span className="absolute left-1/2 top-1/2 grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-accent text-sm font-medium text-accent-ink shadow-lg">⇆</span>
        </div>
        <input type="range" min={0} max={100} value={value} aria-label="Compare the page with and without TagAWallet" className="sr-only"
          onChange={(e) => { const v = Number(e.target.value); s.current.touched = true; s.current.target = v; setValue(v); apply(v); }} />
      </div>
    </div>
  );
}

function Visual({ i }: { i: number }) {
  if (i === 0) return (
    <div className="rounded-xl border border-line bg-card p-5">
      <p className="text-xs text-muted">Tag <span className="addr text-ink">0xdEAD…bEEF</span>. Only you will see it.</p>
      <div className="mt-3 rounded-md border border-line bg-paper px-3 py-2">Bob, market maker<span className="animate-pulse text-accent">▏</span></div>
      <div className="mt-3 flex items-center justify-between text-xs text-muted"><span>Visibility: only you</span><span className="rounded-md bg-accent px-3 py-1.5 font-medium text-accent-ink">Save</span></div>
    </div>
  );
  if (i === 1) return (
    <div className="rounded-xl border border-line bg-card p-5">
      <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-full bg-wash font-semibold">A</span><div><p className="font-semibold">Alice, OTC desk</p><p className="text-xs text-muted">Entity · 4 wallets</p></div></div>
      <ul className="mt-4 divide-y divide-line text-xs">
        {["Ethereum", "Base", "Solana", "Bitcoin"].map((c, k) => <li key={c} className="flex justify-between py-2"><span className="addr">{["0x7a25…488D", "0x7a25…488D", "7xKX…gAsU", "bc1q…f3k9"][k]}</span><span className="text-muted">{c}</span></li>)}
      </ul>
    </div>
  );
  if (i === 2) return (
    <div className="space-y-3 rounded-xl border border-line bg-card p-5">
      {([["Alice, OTC desk", "Your private tag", "mine"], ["DAO treasury", "Shared by Research", "warn"], ["Grants multisig", "Self-claimed", "accent"], ["Exchange hot wallet", "Verified", "good"]] as const).map(([n, s, t]) => (
        <div key={n}><Chip name={n} source={s} tone={t} /></div>
      ))}
    </div>
  );
  return (
    <div className="rounded-xl border border-line bg-card p-5">
      <p className="leading-relaxed"><span className="font-semibold">@onchain_notes</span> <span className="text-muted">· 4m</span></p>
      <p className="mt-1 leading-relaxed">Big move from <Chip name="Alice, OTC desk" source="Private" /> into <Chip name="Exchange hot wallet" source="Verified" tone="good" /> this morning.</p>
      <p className="mt-4 text-xs text-muted">Works on {CHAINS.slice(0, 4).join(", ")} and more.</p>
    </div>
  );
}

function WipeFooter({ signedIn }: { signedIn: boolean }) {
  const root = useRef<HTMLElement>(null);
  const top = useRef<HTMLDivElement>(null);
  useScrollProgress(root, (p) => {
    if (top.current) top.current.style.clipPath = `inset(0 ${100 - ease(seg(p, 0.35, 1)) * 100}% 0 0)`;
  });
  return (
    <footer ref={root} className="overflow-hidden border-t border-line">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-end justify-between gap-6 px-4 pt-16">
        <div>
          <BrandMark size={64} />
          <p className="mt-4 max-w-xl text-4xl font-semibold leading-[1.05] tracking-tight md:text-5xl">See the page the way it should have been.</p>
          <Cta signedIn={signedIn} className="mt-5" />
        </div>
        <FootLinks className="text-muted" />
      </div>
      <div className="relative mt-10 grid h-[19vw] place-items-center pb-16 md:pb-6" aria-label="TagAWallet" role="img">
        <span className="addr absolute whitespace-nowrap text-[11vw] leading-none text-muted/50" aria-hidden>0x7a25…488D</span>
        <div ref={top} className="absolute inset-0 grid place-items-center bg-paper" aria-hidden>
          <span className="whitespace-nowrap text-[16vw] font-semibold leading-none tracking-tight">TagAWallet</span>
        </div>
      </div>
    </footer>
  );
}

export function CompareLanding({ signedIn }: { signedIn: boolean }) {
  return (
    <>
      <Nav signedIn={signedIn} />
      <main>
        <section className="mx-auto w-full max-w-6xl px-4 pb-20 pt-28 md:pt-32">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <h1 className="rise max-w-3xl text-5xl font-semibold leading-[1] tracking-tight md:text-7xl">Know who&apos;s behind every wallet.</h1>
            <div className="rise max-w-sm" style={{ "--d": "120ms" } as React.CSSProperties}>
              <p className="text-muted">Privately tag addresses, link socials, group related wallets, and recognize identities wherever you research and trade.</p>
              <Cta signedIn={signedIn} className="mt-4" />
            </div>
          </div>
          <div className="rise mt-10" style={{ "--d": "220ms" } as React.CSSProperties}><Wipe /></div>
        </section>
        {POINTS.map((p, i) => (
          <section key={p.title} className="mx-auto grid w-full max-w-6xl items-center gap-8 px-4 py-14 md:grid-cols-2 md:gap-16 md:py-20">
            <Reveal className={i % 2 ? "md:order-2" : ""}>
              <h2 className="text-3xl font-semibold leading-tight tracking-tight md:text-5xl">{p.title}</h2>
              <p className="mt-3 max-w-md text-muted md:text-lg">{p.body}</p>
            </Reveal>
            <Reveal delay={100}><Visual i={i} /></Reveal>
          </section>
        ))}
        <section className="mx-auto w-full max-w-6xl px-4 py-14">
          <Reveal className="rounded-xl bg-wash p-6">
            <h2 className="font-semibold">TagAWallet is not a wallet.</h2>
            <p className="mt-1.5 max-w-2xl text-muted">{NOT_A_WALLET.replace("TagAWallet is not a wallet. ", "")}</p>
          </Reveal>
        </section>
      </main>
      <WipeFooter signedIn={signedIn} />
    </>
  );
}

export { Wipe, Visual, WipeFooter };
