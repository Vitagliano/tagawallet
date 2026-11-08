"use client";
import { useEffect, useRef, useState } from "react";
import { BrandMark } from "@/components/brand-mark";
import { CHAINS, Chip, Cta, FootLinks, NOT_A_WALLET, Nav, Reveal, SAMPLE_TAGS, seg, ease, reducedMotion, useFrame, useInView, useScrollProgress, type Tone } from "../shared";

type Tag = { name: string; source: string; tone: Tone };
const WALLETS = ["0x7a25…488D", "0x1f98…F984", "0xdEAD…bEEF", "0x28C6…1d60"];
const INITIAL: Record<string, Tag> = { "0x28C6…1d60": { name: "Exchange hot wallet", source: "Verified", tone: "good" } };

const SURFACES = [
  { id: "Explorer", url: "an explorer you already use" },
  { id: "X", url: "the feed you read" },
  { id: "Trading", url: "the trading tool you use" },
] as const;
type Surface = (typeof SURFACES)[number]["id"];

function Address({ addr, tag, onTag, editing }: { addr: string; tag?: Tag; onTag: () => void; editing: boolean }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className="addr">{addr}</span>
      {tag ? <span key={tag.name} className="pop inline-flex"><Chip name={tag.name} source={tag.source} tone={tag.tone} /></span> : (
        <button type="button" onClick={onTag} aria-expanded={editing} className="rounded-md border border-dashed border-accent/60 px-1.5 py-0.5 text-xs font-medium text-accent hover:bg-accent/10">Tag this wallet</button>
      )}
    </span>
  );
}

function Demo() {
  const [tags, setTags] = useState(INITIAL);
  const [surface, setSurface] = useState<Surface>("Explorer");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [nudge, setNudge] = useState(false);
  const shell = useRef<HTMLDivElement>(null);
  const mira = useRef<HTMLDivElement>(null);
  const miraDone = useRef(false);

  const commit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setTags((t) => ({ ...t, [editing]: { name: draft.trim().slice(0, 28) || "My first tag", source: "Your private tag", tone: "mine" } }));
    setEditing(null); setDraft(""); setNudge(true);
  };

  // A teammate's cursor drifts in and adds a shared label, as a shared list would.
  useFrame(shell, (_, t) => {
    const el = mira.current, box = shell.current;
    if (!el || !box) return;
    const cycle = t % 14, w = box.clientWidth, h = box.clientHeight;
    const k = ease(seg(cycle, 2, 5));
    el.style.opacity = String(seg(cycle, 1.5, 2.2) * (1 - seg(cycle, 12.5, 13.5)));
    el.style.transform = `translate(${w * 0.92 - k * w * 0.52 + Math.sin(t * 0.8) * 8}px, ${h * 0.88 - k * h * 0.42 + Math.cos(t * 0.6) * 6}px)`;
    if (cycle > 5.3 && !miraDone.current) {
      miraDone.current = true;
      setTags((c) => c["0x1f98…F984"] ? c : { ...c, "0x1f98…F984": { name: "DAO treasury", source: "Shared by Mira", tone: "warn" } });
    }
  });

  const addr = (a: string) => <Address addr={a} tag={tags[a]} editing={editing === a} onTag={() => { setEditing(a); setDraft(""); }} />;

  return (
    <div ref={shell} className="relative overflow-hidden rounded-xl border border-line bg-card text-left shadow-2xl">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
        <span className="size-2.5 rounded-full bg-line" /><span className="size-2.5 rounded-full bg-line" /><span className="size-2.5 rounded-full bg-line" />
        <div role="tablist" aria-label="Sites" className="ml-2 flex gap-1 text-xs">
          {SURFACES.map((s) => (
            <button key={s.id} role="tab" type="button" aria-selected={surface === s.id} onClick={() => { setSurface(s.id); setNudge(false); }}
              className={`relative rounded-md px-2.5 py-1 font-medium transition-colors ${surface === s.id ? "bg-wash" : "text-muted hover:text-ink"}`}>
              {s.id}
              {nudge && surface !== s.id && <span className="absolute -right-0.5 -top-0.5 size-2 animate-ping rounded-full bg-accent" />}
            </button>
          ))}
        </div>
        <span className="ml-auto hidden text-xs text-muted sm:block">{SURFACES.find((s) => s.id === surface)!.url}</span>
      </div>
      <div className="min-h-72 text-sm" key={surface}>
        {surface === "Explorer" && (
          <ul className="divide-y divide-line">
            {WALLETS.map((a, i) => <li key={a} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-4">{addr(a)}<span className="ml-auto text-xs text-muted">{["88.0", "310.2", "0.4", "1,204.5"][i]} ETH</span></li>)}
          </ul>
        )}
        {surface === "X" && (
          <div className="space-y-5 p-4">
            <p className="leading-relaxed"><span className="font-semibold">@onchain_notes</span> <span className="text-muted">· 4m</span><br />Big move this morning from {addr(WALLETS[2])} straight into {addr(WALLETS[3])}. Anyone know who that is?</p>
            <p className="leading-relaxed"><span className="font-semibold">@ledger_lore</span> <span className="text-muted">· 11m</span><br />Same counterparty as last week: {addr(WALLETS[0])}.</p>
          </div>
        )}
        {surface === "Trading" && (
          <table className="w-full text-left">
            <thead className="text-xs text-muted"><tr><th className="px-4 py-3 font-medium">Top traders</th><th className="px-4 py-3 text-right font-medium">Side</th></tr></thead>
            <tbody className="divide-y divide-line">
              {[WALLETS[3], WALLETS[2], WALLETS[1], WALLETS[0]].map((a, i) => <tr key={a}><td className="px-4 py-3.5">{addr(a)}</td><td className={`px-4 py-3.5 text-right text-xs font-medium ${i % 2 ? "text-bad" : "text-good"}`}>{i % 2 ? "Sell" : "Buy"}</td></tr>)}
            </tbody>
          </table>
        )}
      </div>
      {editing && (
        <form onSubmit={commit} className="pop absolute inset-x-3 bottom-3 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-paper p-3 shadow-xl sm:left-auto sm:w-96">
          <label className="w-full text-xs text-muted" htmlFor="demo-tag">Tag <span className="addr text-ink">{editing}</span>. Only you will see it.</label>
          <input id="demo-tag" autoFocus value={draft} maxLength={28} onChange={(e) => setDraft(e.target.value)} placeholder="Bob, market maker" className="min-w-0 flex-1 rounded-md border border-line bg-card px-2.5 py-1.5" />
          <button className="rounded-md bg-accent px-3 py-1.5 font-medium text-accent-ink">Save</button>
        </form>
      )}
      <div ref={mira} className="pointer-events-none absolute left-0 top-0 opacity-0" aria-hidden>
        <svg width="16" height="18" viewBox="0 0 16 18"><path d="M1 1l5 15 2.5-6.5L15 7z" fill="var(--warn)" stroke="var(--card)" /></svg>
        <span className="ml-3 rounded bg-warn px-1.5 py-0.5 text-[11px] font-medium text-paper">Mira</span>
      </div>
      <p aria-live="polite" className="border-t border-line px-4 py-2 text-xs text-muted">
        {nudge ? "Saved. Now switch sites: your tag came with you." : "This is a demo. Tag an address, then switch between sites."}
      </p>
    </div>
  );
}

function Hero({ signedIn }: { signedIn: boolean }) {
  const root = useRef<HTMLElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  useScrollProgress(root, (p) => {
    if (!frame.current || reducedMotion()) return;
    const k = ease(seg(p, 0, 0.6));
    frame.current.style.transform = `perspective(1400px) rotateX(${(1 - k) * 22}deg) scale(${0.92 + k * 0.08}) translateY(${(1 - k) * 12}px)`;
  });
  return (
    <section ref={root}>
      <div className="flex flex-col items-center px-4 pt-24 text-center md:pt-28">
        <h1 className="rise max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tight md:text-6xl">Know who&apos;s behind every wallet.</h1>
        <p className="rise mt-4 max-w-xl text-muted md:text-lg" style={{ "--d": "100ms" } as React.CSSProperties}>Privately tag addresses, link socials, group related wallets, and recognize identities wherever you research and trade.</p>
        <div className="rise mt-5" style={{ "--d": "180ms" } as React.CSSProperties}><Cta signedIn={signedIn} /></div>
        <div ref={frame} className="mt-8 w-full max-w-4xl origin-top will-change-transform" style={{ transform: "perspective(1400px) rotateX(22deg) scale(.92)" }}><Demo /></div>
      </div>
    </section>
  );
}

/** Border and glow that follow the cursor. */
function Spot({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--x", `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty("--y", `${e.clientY - r.top}px`);
  };
  return (
    <div onPointerMove={onMove} className={`group relative overflow-hidden rounded-2xl border border-line bg-card p-6 ${className}`}>
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{ background: "radial-gradient(320px circle at var(--x) var(--y), color-mix(in srgb, var(--accent) 14%, transparent), transparent 70%)" }} />
      <div className="relative">{children}</div>
    </div>
  );
}

function PrivacyCard() {
  const [shared, setShared] = useState(false);
  return (
    <Spot className="md:col-span-2">
      <h2 className="text-xl font-semibold">Private by default</h2>
      <p className="mt-1.5 max-w-md text-muted">Lists, notes and labels are yours alone until you invite someone. There is no public feed of what you&apos;re researching.</p>
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <button type="button" role="switch" aria-checked={shared} aria-label="Share this list" onClick={() => setShared((v) => !v)} className={`relative h-7 w-12 rounded-full transition-colors ${shared ? "bg-accent" : "bg-line"}`}>
          <span className={`absolute left-1 top-1 size-5 rounded-full bg-card shadow transition-transform duration-300 ${shared ? "translate-x-5" : ""}`} />
        </button>
        <span className="text-sm font-medium">{shared ? "Research list: shared with 2 people" : "Research list: only you"}</span>
        <span className={`flex -space-x-1.5 transition-opacity duration-300 ${shared ? "opacity-100" : "opacity-0"}`} aria-hidden>
          {["M", "T"].map((a) => <span key={a} className="grid size-7 place-items-center rounded-full border-2 border-card bg-wash text-xs font-semibold">{a}</span>)}
        </span>
      </div>
    </Spot>
  );
}

function EntityCard() {
  const [ref, inView] = useInView<HTMLDivElement>();
  const chains = ["Ethereum", "Base", "Solana", "Bitcoin"];
  return (
    <Spot>
      <h2 className="text-xl font-semibold">One entity, many wallets</h2>
      <p className="mt-1.5 text-muted">Every address of a person, project, DAO or exchange, across chains.</p>
      <div ref={ref} className="relative mt-5 h-40">
        {chains.map((c, i) => (
          <div key={c} className="absolute inset-x-0 flex items-center justify-between rounded-lg border border-line bg-paper px-3 py-2 text-xs shadow-sm transition-transform duration-700"
            style={{ top: 0, zIndex: 4 - i, transitionDelay: `${i * 70}ms`, transform: inView ? `translateY(${i * 40}px)` : `translateY(${i * 4}px) scale(${1 - i * 0.03})` }}>
            <span className="addr">{`0x${(i + 3) * 1234}…${(i + 7) * 871}`}</span><span className="text-muted">{c}</span>
          </div>
        ))}
      </div>
    </Spot>
  );
}

function SourceCard() {
  return (
    <Spot>
      <h2 className="text-xl font-semibold">Every label shows its source</h2>
      <p className="mt-1.5 text-muted">You always know who is saying what.</p>
      <div className="mt-5 flex flex-wrap gap-2">
        <Chip name="Alice" source="Your private tag" /><Chip name="DAO treasury" source="Shared" tone="warn" /><Chip name="Grants multisig" source="Self-claimed" tone="accent" /><Chip name="Exchange" source="Verified" tone="good" />
      </div>
    </Spot>
  );
}

function WorkCard() {
  return (
    <Spot className="md:col-span-2">
      <h2 className="text-xl font-semibold">Where you already work</h2>
      <p className="mt-1.5 max-w-md text-muted">Chips appear next to addresses on explorers, X and trading tools you enable. Page content never leaves your browser.</p>
      <div className="relative mt-5 overflow-hidden" style={{ maskImage: "linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)" }}>
        <div className="marquee gap-2" style={{ "--t": "28s" } as React.CSSProperties}>
          {[...CHAINS, ...CHAINS].map((c, i) => <span key={i} className="rounded-md border border-line px-2 py-1 text-xs font-medium">{c}</span>)}
        </div>
      </div>
    </Spot>
  );
}

function CurtainFooter({ signedIn }: { signedIn: boolean }) {
  const tags = [...SAMPLE_TAGS, ...SAMPLE_TAGS, ...SAMPLE_TAGS];
  return (
    <footer className="sticky bottom-0 z-0 flex min-h-[88dvh] flex-col justify-between overflow-hidden bg-wash pb-16 pt-14">
      <div className="mx-auto w-full max-w-6xl px-4">
        <BrandMark size={80} />
        <p className="mt-6 max-w-3xl text-5xl font-semibold leading-[1] tracking-tight md:text-8xl">Stop squinting at <span className="addr text-accent">0x…</span></p>
        <Cta signedIn={signedIn} className="mt-7" />
      </div>
      <div className="my-10 space-y-2 overflow-hidden" aria-hidden>
        <div className="marquee gap-2">{tags.map((t, i) => <Chip key={i} className="text-sm" {...t} />)}</div>
        <div className="marquee gap-2" style={{ animationDirection: "reverse", "--t": "44s" } as React.CSSProperties}>{tags.map((t, i) => <Chip key={i} className="text-sm" {...tags[(i + 4) % tags.length]} />)}</div>
      </div>
      <FootLinks className="mx-auto w-full max-w-6xl px-4 text-muted" />
    </footer>
  );
}

export function PlaygroundLanding({ signedIn }: { signedIn: boolean }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <div data-mounted={mounted}>
      <Nav signedIn={signedIn} />
      <main className="relative z-10 rounded-b-[2.5rem] border-b border-line bg-paper shadow-2xl">
        <Hero signedIn={signedIn} />
        <section className="mx-auto grid w-full max-w-5xl gap-4 px-4 py-20 md:grid-cols-3">
          <PrivacyCard /><EntityCard /><SourceCard /><WorkCard />
        </section>
        <section className="mx-auto w-full max-w-5xl px-4 pb-24">
          <Reveal className="rounded-xl bg-wash p-6">
            <h2 className="font-semibold">TagAWallet is not a wallet.</h2>
            <p className="mt-1.5 max-w-2xl text-muted">{NOT_A_WALLET.replace("TagAWallet is not a wallet. ", "")} Anyone asking for those in our name is not us.</p>
          </Reveal>
        </section>
      </main>
      <CurtainFooter signedIn={signedIn} />
    </div>
  );
}
