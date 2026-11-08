"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { BrandMark } from "@/components/brand-mark";
import { CHAINS, Chip, Cta, NOT_A_WALLET, Nav, POINTS, Reveal, SAMPLE_TAGS, fakeAddr, reducedMotion, useFrame, useScrollProgress, type Tone } from "../shared";

type Entity = { name: string; kind: string; source: string; tone: Tone; wallets: { addr: string; chain: string }[]; links: string[]; note: string };

const ENTITIES: Entity[] = [
  { name: "Alice, OTC desk", kind: "Person", source: "Your private tag", tone: "mine", note: "Met at a conference. Settles fast.", links: ["X", "Telegram"], wallets: [{ addr: "0x7a25…488D", chain: "Ethereum" }, { addr: "0x7a25…488D", chain: "Base" }, { addr: "7xKX…gAsU", chain: "Solana" }] },
  { name: "DAO treasury", kind: "DAO", source: "Shared by Research", tone: "warn", note: "Main treasury and two grant wallets.", links: ["Website", "GitHub"], wallets: [{ addr: "0x1f98…F984", chain: "Ethereum" }, { addr: "0xb0A8…F5D2", chain: "Arbitrum" }] },
  { name: "Exchange hot wallet", kind: "Exchange", source: "Verified", tone: "good", note: "Verified public profile.", links: ["Website", "X"], wallets: [{ addr: "0x28C6…1d60", chain: "Ethereum" }, { addr: "0x60AE…b4A6", chain: "BNB Chain" }, { addr: "bc1q…f3k9", chain: "Bitcoin" }] },
  { name: "Grants multisig", kind: "Project", source: "Self-claimed", tone: "accent", note: "Claimed by the project, not yet verified.", links: ["ENS", "Website"], wallets: [{ addr: "0x2b1d…5d2b", chain: "Optimism" }] },
  { name: "My cold storage", kind: "Mine", source: "Your private tag", tone: "mine", note: "Never sign from here.", links: [], wallets: [{ addr: "0x9C7E…c8F9", chain: "Ethereum" }, { addr: "bc1p…7w2e", chain: "Bitcoin" }] },
];
const DEMO_QUERIES = ["0x7a25", "treasury", "bitcoin", "verified"];

function Palette() {
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [taken, setTaken] = useState(false);

  // Types example searches until the visitor starts using it.
  useEffect(() => {
    if (taken || reducedMotion()) return;
    let q = 0, n = 0, dir = 1, wait = 0;
    const id = setInterval(() => {
      if (wait-- > 0) return;
      const word = DEMO_QUERIES[q];
      n += dir;
      setQuery(word.slice(0, n));
      setActive(0);
      if (n >= word.length) { dir = -1; wait = 28; }
      if (n <= 0) { dir = 1; q = (q + 1) % DEMO_QUERIES.length; wait = 4; }
    }, 75);
    return () => clearInterval(id);
  }, [taken]);

  useEffect(() => {
    const on = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); input.current?.focus(); } };
    addEventListener("keydown", on);
    return () => removeEventListener("keydown", on);
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ENTITIES;
    return ENTITIES.filter((e) => [e.name, e.kind, e.source, ...e.wallets.flatMap((w) => [w.addr, w.chain])].join(" ").toLowerCase().includes(q));
  }, [query]);
  const current = results[Math.min(active, results.length - 1)];

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-card text-left shadow-2xl">
      <div className="flex items-center gap-3 border-b border-line px-4 py-3.5">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-muted" aria-hidden><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        <input ref={input} value={query} onFocus={() => { if (!taken) { setTaken(true); setQuery(""); setActive(0); } }} onChange={(e) => { setTaken(true); setQuery(e.target.value); setActive(0); }} onKeyDown={onKey}
          aria-label="Search the example wallets" placeholder="Search a name, address or chain" className="min-w-0 flex-1 bg-transparent text-lg outline-none placeholder:text-muted" style={{ outline: "none" }} />
        <kbd className="hidden rounded border border-line px-1.5 py-0.5 text-xs text-muted sm:block">⌘K</kbd>
      </div>
      <div className="grid h-[340px] md:grid-cols-[1fr_1.1fr]">
        <ul className="overflow-y-auto p-2 md:border-r md:border-line">
          {results.map((e, i) => (
            <li key={e.name}>
              <button type="button" onPointerEnter={() => setActive(i)} onFocus={() => setActive(i)} onClick={() => setActive(i)}
                className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left ${current === e ? "bg-wash" : ""}`}>
                <span className="min-w-0"><span className="block truncate font-medium">{e.name}</span><span className="block text-xs text-muted">{e.kind} · {e.wallets.length} {e.wallets.length === 1 ? "wallet" : "wallets"}</span></span>
                <Chip name={e.source.startsWith("Your") ? "Private" : e.source.split(" ")[0]} tone={e.tone} className="shrink-0" />
              </button>
            </li>
          ))}
          {!results.length && (
            <li className="p-4 text-sm text-muted">
              <p>Nothing tagged for <span className="addr text-ink">{query}</span> yet.</p>
              <span className="mt-3 inline-block rounded-md border border-dashed border-accent/60 px-2 py-1 text-xs font-medium text-accent">Tag this wallet</span>
            </li>
          )}
        </ul>
        {current && (
          <div key={current.name} className="pop hidden flex-col overflow-y-auto p-5 md:flex">
            <p className="text-xl font-semibold tracking-tight">{current.name}</p>
            <div className="mt-1.5"><Chip name={current.kind} source={current.source} tone={current.tone} /></div>
            <p className="mt-3 text-sm text-muted">{current.note}</p>
            <ul className="mt-4 divide-y divide-line border-y border-line text-xs">
              {current.wallets.map((w) => <li key={w.chain + w.addr} className="flex justify-between py-2"><span className="addr">{w.addr}</span><span className="text-muted">{w.chain}</span></li>)}
            </ul>
            <div className="mt-3 flex gap-2 text-xs text-muted">{current.links.map((l) => <span key={l} className="rounded-md border border-line px-1.5 py-0.5">{l}</span>)}</div>
          </div>
        )}
      </div>
      <p className="border-t border-line px-4 py-2 text-xs text-muted">Example data. Your real lists are private to you.</p>
    </div>
  );
}

function Bento() {
  return (
    <section className="mx-auto grid w-full max-w-5xl gap-4 px-4 py-16 md:grid-cols-6">
      <Reveal className="rounded-2xl bg-accent p-7 text-accent-ink md:col-span-4">
        <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">{POINTS[0].title}</h2>
        <p className="mt-2 max-w-md opacity-85">{POINTS[0].body}</p>
      </Reveal>
      <Reveal delay={80} className="rounded-2xl border border-line bg-card p-7 md:col-span-2">
        <p className="text-5xl font-semibold tracking-tight">{CHAINS.length}</p>
        <p className="mt-2 text-muted">chains at launch: {CHAINS.join(", ")}.</p>
      </Reveal>
      <Reveal delay={60} className="rounded-2xl border border-line bg-card p-7 md:col-span-3">
        <h2 className="text-xl font-semibold">{POINTS[1].title}</h2>
        <p className="mt-2 text-muted">{POINTS[1].body}</p>
      </Reveal>
      <Reveal delay={120} className="rounded-2xl border border-line bg-card p-7 md:col-span-3">
        <h2 className="text-xl font-semibold">{POINTS[2].title}</h2>
        <p className="mt-2 text-muted">{POINTS[2].body}</p>
      </Reveal>
    </section>
  );
}

const COL_A = Array.from({ length: 12 }, (_, i) => i), COL_B = Array.from({ length: 12 }, (_, i) => i + 20);

function Row({ i }: { i: number }) {
  const t = SAMPLE_TAGS[i % SAMPLE_TAGS.length];
  return <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-card px-3 py-3"><span className="addr truncate text-xs md:text-sm">{fakeAddr(i)}</span><Chip name={t.name} tone={t.tone} /></div>;
}

function Everywhere() {
  const root = useRef<HTMLElement>(null);
  const a = useRef<HTMLDivElement>(null);
  const b = useRef<HTMLDivElement>(null);
  useScrollProgress(root, (p) => {
    if (a.current) a.current.style.transform = `translateY(${-p * 34}%)`;
    if (b.current) b.current.style.transform = `translateY(${-34 + p * 34}%)`;
  });
  return (
    <section ref={root} className="h-[230vh]" aria-label={POINTS[3].title}>
      <div className="sticky top-0 h-dvh overflow-hidden">
        <div className="mx-auto grid h-full w-full max-w-6xl items-center gap-8 px-4 md:grid-cols-[1fr_1.4fr]">
          <div className="pt-20 md:pt-0">
            <h2 className="text-4xl font-semibold leading-[1.05] tracking-tight md:text-6xl">{POINTS[3].title}</h2>
            <p className="mt-3 max-w-sm text-muted md:text-lg">{POINTS[3].body}</p>
          </div>
          <div className="grid h-full grid-cols-1 gap-3 overflow-hidden sm:grid-cols-2" style={{ maskImage: "linear-gradient(transparent, #000 15%, #000 85%, transparent)" }} aria-hidden>
            <div ref={a} className="space-y-3 will-change-transform">{COL_A.map((i) => <Row key={i} i={i} />)}</div>
            <div ref={b} className="hidden space-y-3 will-change-transform sm:block">{COL_B.map((i) => <Row key={i} i={i} />)}</div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CommandFooter({ signedIn }: { signedIn: boolean }) {
  const mark = useRef<HTMLDivElement>(null);
  useFrame(mark, (_, t) => { if (mark.current) mark.current.style.transform = `translateY(${Math.sin(t) * 6}px) rotate(${Math.sin(t * 0.7) * 3}deg)`; });
  const rows = [
    { label: signedIn ? "Open dashboard" : "Start tagging, it's free", href: signedIn ? "/dashboard" : "/signup", strong: true },
    { label: "Sign in", href: "/login" },
    { label: "Privacy", href: "/privacy" },
    { label: "Terms", href: "/terms" },
  ];
  return (
    <footer className="border-t border-line bg-wash">
      <div className="mx-auto grid w-full max-w-5xl items-center gap-10 px-4 pb-24 pt-16 md:grid-cols-[1fr_1.3fr]">
        <div>
          <div ref={mark} className="w-fit will-change-transform"><BrandMark size={110} /></div>
          <p className="mt-6 text-4xl font-semibold leading-[1.05] tracking-tight">What are you looking for next?</p>
          <p className="mt-3 text-sm text-muted">© {new Date().getFullYear()} TagAWallet</p>
        </div>
        <nav aria-label="Footer" className="overflow-hidden rounded-2xl border border-line bg-card p-2 shadow-xl">
          {rows.map((r) => (
            <Link key={r.href} href={r.href} className={`group flex items-center justify-between rounded-lg px-4 py-4 text-lg transition-colors ${r.strong ? "font-semibold" : ""} hover:bg-accent hover:text-accent-ink`}>
              <span className="transition-transform duration-200 group-hover:translate-x-1">{r.label}</span>
              <span aria-hidden className="opacity-60 transition-transform duration-200 group-hover:translate-x-1">→</span>
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}

export function SearchLanding({ signedIn }: { signedIn: boolean }) {
  return (
    <>
      <Nav signedIn={signedIn} />
      <main>
        <section className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col justify-center px-4 pb-20 pt-24">
          <div className="text-center">
            <h1 className="rise text-4xl font-semibold leading-[1.02] tracking-tight md:text-7xl">Know who&apos;s behind every wallet.</h1>
            <p className="rise mx-auto mt-4 max-w-xl text-muted md:text-lg" style={{ "--d": "100ms" } as React.CSSProperties}>Privately tag addresses, link socials, group related wallets, and recognize identities wherever you research and trade.</p>
            <div className="rise mt-5" style={{ "--d": "170ms" } as React.CSSProperties}><Cta signedIn={signedIn} /></div>
          </div>
          <div className="rise mt-8" style={{ "--d": "260ms" } as React.CSSProperties}><Palette /></div>
        </section>
        <Bento />
        <Everywhere />
        <section className="mx-auto w-full max-w-5xl px-4 py-16"><Reveal className="rounded-xl bg-wash p-6"><p className="max-w-2xl text-muted">{NOT_A_WALLET}</p></Reveal></section>
      </main>
      <CommandFooter signedIn={signedIn} />
    </>
  );
}
