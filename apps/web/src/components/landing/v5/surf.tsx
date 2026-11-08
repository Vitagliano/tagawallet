"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { BrandMark } from "@/components/brand-mark";
import { Logo } from "@/components/ui";

/* The landing page is a tiny fictional internet with the extension installed in its toolbar. */

type Site = "chainscan" | "feedr" | "swapdesk" | "welcome";
const URLS: Record<Site, string> = { chainscan: "chainscan.example/tx/recent", feedr: "feedr.example/home", swapdesk: "swapdesk.example/top-traders", welcome: "tagawallet.com/welcome" };
const TITLES: Record<Site, string> = { chainscan: "Chainscan", feedr: "Feedr", swapdesk: "Swapdesk", welcome: "TagAWallet" };

type Tag = { name: string; source: string; tone: "yours" | "shared" | "verified" };
const MYSTERY = "0x4c1f…2c15";
const STARTING: Record<string, Tag> = {
  "0xb71a…40ce": { name: "Exchange hot wallet", source: "Verified", tone: "verified" },
  "0x9e0b…77d1": { name: "DAO treasury", source: "Shared by Research", tone: "shared" },
};
const TONE = { yours: "bg-[#EE6A42] text-[#1a0d07] border-transparent", shared: "bg-warn/15 text-warn border-warn/40", verified: "bg-good/15 text-good border-good/40" };
const QUEST = ["Tag the mystery wallet", "See it on Feedr", "See it on Swapdesk", "Turn the extension off and on"];

function ExtIcon({ size = 20 }: { size?: number }) { return <BrandMark size={size} />; }

export function SurfLanding({ signedIn }: { signedIn: boolean }) {
  const [tabs, setTabs] = useState<Site[]>(["chainscan", "feedr", "swapdesk"]);
  const [site, setSite] = useState<Site>("chainscan");
  const [history, setHistory] = useState<Site[]>(["chainscan"]);
  const [tags, setTags] = useState(STARTING);
  const [on, setOn] = useState(true);
  const [disabled, setDisabled] = useState<Partial<Record<Site, boolean>>>({});
  const [popup, setPopup] = useState(false);
  const [editing, setEditing] = useState<{ a: string; slot: number } | null>(null);
  const [draft, setDraft] = useState("");
  const [done, setDone] = useState<boolean[]>([false, false, false, false]);
  const offSeen = useRef(false);
  const count = done.filter(Boolean).length;
  const tagged = !!tags[MYSTERY];

  const mark = (i: number) => setDone((d) => {
    if (d[i]) return d;
    const n = d.map((v, k) => (k === i ? true : v));
    if (n.every(Boolean)) setTabs((t) => (t.includes("welcome") ? t : [...t, "welcome"]));
    return n;
  });

  const go = (s: Site) => {
    setSite(s); setHistory((h) => [...h, s]); setEditing(null);
    if (tagged && s === "feedr") mark(1);
    if (tagged && s === "swapdesk") mark(2);
  };
  const back = () => { if (history.length < 2) return; const h = history.slice(0, -1); setHistory(h); setSite(h[h.length - 1]); setEditing(null); };
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setTags((t) => ({ ...t, [editing.a]: { name: draft.trim().slice(0, 28) || "My first tag", source: "Your private tag", tone: "yours" } }));
    if (editing.a === MYSTERY) mark(0);
    setEditing(null); setDraft("");
  };
  const toggle = () => {
    const next = !on;
    setOn(next);
    if (!next) offSeen.current = true;
    if (next && offSeen.current && tagged) mark(3);
  };

  const showing = on && !disabled[site];

  // Called as a function, not a component, so the name field keeps focus while typing.
  let slots = 0;
  const addr = (a: string) => {
    const t = tags[a], slot = slots++;
    if (editing?.a === a && editing.slot === slot) return (
      <form key={slot} onSubmit={save} className="pop inline-flex items-center gap-1 rounded-l-full rounded-r-md bg-[#EE6A42] py-0.5 pl-3 pr-0.5 align-middle text-[#1a0d07]">
        <input autoFocus value={draft} maxLength={28} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") setEditing(null); }} aria-label={`Name ${a}`} placeholder="Name it" className="w-32 bg-transparent py-0.5 text-sm font-semibold outline-none placeholder:text-black/50 md:w-40" style={{ outline: "none" }} />
        <button className="rounded bg-black/25 px-2 py-0.5 text-xs font-medium text-white">Save</button>
      </form>
    );
    return (
      <span key={slot} className="inline-flex flex-wrap items-center gap-1.5 align-middle">
        {(!showing || !t) && <span className="font-mono text-[.92em]">{a}</span>}
        {showing && t && <span key={t.name} className={`pop inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-xs font-medium ${TONE[t.tone]}`} title={a}>{t.name}<span className="font-normal opacity-70">{t.source}</span></span>}
        {showing && !t && <button type="button" onClick={() => { setEditing({ a, slot }); setDraft(""); }} className={`whitespace-nowrap rounded-md border border-dashed border-accent px-1.5 py-0.5 text-xs font-medium text-accent hover:bg-accent/10 ${a === MYSTERY && !tagged ? "pulse-tag" : ""}`}>Tag</button>}
      </span>
    );
  };

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-wash">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 py-2.5 md:px-5">
        <div className="flex min-w-0 items-center gap-4">
          <Logo className="hidden sm:inline-flex" />
          <h1 className="text-lg font-semibold leading-tight tracking-tight md:text-3xl">Know who&apos;s behind every wallet. <span className="font-normal text-muted">Go on, browse.</span></h1>
        </div>
        <nav className="flex items-center gap-3 text-sm"><Link href="/login" className="hover:underline">Sign in</Link><Link href={signedIn ? "/dashboard" : "/signup"} className="rounded-md bg-accent px-3 py-1.5 font-medium text-accent-ink">{signedIn ? "Dashboard" : "Get started"}</Link></nav>
      </header>

      <main className="mx-2 mb-2 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-line bg-card shadow-2xl md:mx-4 md:mb-16">
        {/* Browser chrome */}
        <div role="tablist" aria-label="Open sites" className="flex shrink-0 items-end gap-1 overflow-x-auto border-b border-line bg-wash px-2 pt-2">
          {tabs.map((t) => (
            <button key={t} role="tab" type="button" aria-selected={site === t} onClick={() => go(t)} className={`flex shrink-0 items-center gap-2 rounded-t-lg border border-b-0 px-3 py-1.5 text-sm ${site === t ? "border-line bg-card font-medium" : "border-transparent text-muted hover:text-ink"} ${t === "welcome" ? "text-accent" : ""}`}>
              <span aria-hidden className={`size-3 rounded-sm ${t === "chainscan" ? "bg-[#2f6f9f]" : t === "feedr" ? "bg-[#7b5bd6]" : t === "swapdesk" ? "bg-[#1b7a4a]" : "bg-[#EE6A42]"}`} />{TITLES[t]}
            </button>
          ))}
        </div>
        <div className="relative z-20 flex shrink-0 items-center gap-2 border-b border-line px-2 py-1.5 md:px-3">
          <button type="button" aria-label="Back" onClick={back} disabled={history.length < 2} className="grid size-7 place-items-center rounded-md text-muted hover:bg-wash disabled:opacity-40">←</button>
          <p className="min-w-0 flex-1 truncate rounded-full bg-wash px-3 py-1 font-mono text-xs text-muted">{URLS[site]}</p>
          <span className="hidden font-mono text-xs text-muted lg:inline">{count}/{QUEST.length}</span>
          <div className="relative">
            <button type="button" aria-label="TagAWallet extension" aria-expanded={popup} onClick={() => setPopup((v) => !v)} className={`relative grid size-8 place-items-center rounded-md hover:bg-wash ${on ? "" : "opacity-40 grayscale"}`}>
              <ExtIcon />
              <span aria-hidden className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-accent px-1 text-center text-[10px] font-semibold leading-4 text-accent-ink">{Object.keys(tags).length}</span>
            </button>
            {popup && (
              <div className="pop absolute right-0 top-10 z-30 w-72 rounded-xl border border-line bg-card p-3 text-sm shadow-2xl">
                <div className="flex items-center justify-between"><span className="font-semibold">TagAWallet</span>
                  <button type="button" role="switch" aria-checked={on} aria-label="Extension on" onClick={toggle} className={`relative h-6 w-11 rounded-full transition-colors ${on ? "bg-accent" : "bg-line"}`}><span className={`absolute left-0.5 top-0.5 size-5 rounded-full bg-card shadow transition-transform duration-200 ${on ? "translate-x-5" : ""}`} /></button>
                </div>
                <label className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3"><span>Show names on {TITLES[site]}</span><input type="checkbox" checked={!disabled[site]} onChange={(e) => setDisabled((d) => ({ ...d, [site]: !e.target.checked }))} className="size-4 accent-[var(--accent)]" /></label>
                <p className="mt-3 border-t border-line pt-3 text-xs font-medium text-muted">Your tags</p>
                <ul className="mt-1 space-y-1">{Object.entries(tags).map(([a, t]) => <li key={a} className="flex justify-between gap-2"><span className="truncate font-medium">{t.name}</span><span className="shrink-0 font-mono text-xs text-muted">{a}</span></li>)}</ul>
                <p className="mt-3 border-t border-line pt-3 text-xs text-muted">Not a wallet. It holds no funds and never asks for your seed phrase, private key or a signature.</p>
              </div>
            )}
          </div>
        </div>

        {/* The page */}
        <div className="min-h-0 flex-1 overflow-y-auto" onClick={() => setPopup(false)}>
          {site === "chainscan" && (
            <div className="text-sm md:text-base">
              <div className="bg-[#23435e] px-4 py-4 text-white md:px-6"><p className="text-xl font-semibold">Chainscan</p><p className="text-xs text-white/70">Latest transactions on a made-up chain</p></div>
              <div className="divide-y divide-line">
                {([["0xb71a…40ce", MYSTERY, "1,204.5 ETH", "2 min"], [MYSTERY, "0x72ca…1e06", "88.0 ETH", "9 min"], ["0x9e0b…77d1", MYSTERY, "310.2 ETH", "14 min"], ["0x03fd…a98b", "0xb71a…40ce", "12.0 ETH", "21 min"], ["0x72ca…1e06", "0x9e0b…77d1", "41.2 ETH", "33 min"], ["0xb71a…40ce", "0x03fd…a98b", "540.0 ETH", "48 min"], [MYSTERY, "0xb71a…40ce", "6.5 ETH", "1 hr"]] as const).map(([f, t, v, a]) => (
                  <div key={f + t + a} className="grid gap-x-3 gap-y-1 px-4 py-3.5 sm:grid-cols-[1.3fr_1.3fr_.6fr] md:px-6"><span><span className="mr-2 text-xs text-muted">From</span>{addr(f)}</span><span><span className="mr-2 text-xs text-muted">To</span>{addr(t)}</span><span className="text-xs text-muted sm:text-right">{v} · {a}</span></div>
                ))}
              </div>
            </div>
          )}
          {site === "feedr" && (
            <div className="mx-auto max-w-2xl divide-y divide-line border-x border-line text-[15px] md:text-lg">
              {[{ h: "@onchain_notes", w: "4m", b: <>Big move this morning. Funds went straight to {addr(MYSTERY)}. Anyone know who that is?</> }, { h: "@ledger_lore", w: "11m", b: <>Same counterparty as last week, and it came from {addr("0xb71a…40ce")}.</> }, { h: "@dao_watcher", w: "1h", b: <>{addr("0x9e0b…77d1")} just moved 310 ETH.</> }].map((p) => (
                <article key={p.h} className="flex gap-3 p-4"><span aria-hidden className="size-10 shrink-0 rounded-full bg-[#7b5bd6]/25" /><p className="leading-relaxed"><span className="font-semibold">{p.h}</span> <span className="text-muted">· {p.w}</span><br />{p.b}</p></article>
              ))}
            </div>
          )}
          {site === "swapdesk" && (
            <div className="text-sm md:text-base">
              <div className="flex items-baseline justify-between bg-[#12301f] px-4 py-4 text-white md:px-6"><p className="text-xl font-semibold">Swapdesk</p><p className="font-mono text-xs text-[#55c58d]">Top traders</p></div>
              <table className="w-full text-left"><tbody className="divide-y divide-line">
                {([[MYSTERY, "Buy", "+88.0"], ["0x72ca…1e06", "Sell", "-41.2"], ["0xb71a…40ce", "Buy", "+540.0"], ["0x03fd…a98b", "Sell", "-12.0"]] as const).map(([a, s, v]) => <tr key={a}><td className="px-4 py-4 md:px-6">{addr(a)}</td><td className={`px-2 py-3 text-xs font-medium ${s === "Buy" ? "text-good" : "text-bad"}`}>{s}</td><td className="px-4 py-3 text-right font-mono text-xs md:px-6">{v}</td></tr>)}
              </tbody></table>
            </div>
          )}
          {site === "welcome" && (
            <div className="pop flex min-h-full flex-col items-center justify-center p-6 text-center">
              <BrandMark size={96} />
              <h2 className="mt-5 text-[clamp(2.25rem,6vw,4.5rem)] font-semibold leading-[1] tracking-tight">You&apos;ve used TagAWallet.</h2>
              <p className="mt-3 max-w-lg text-muted md:text-lg">One tag, on every site you enable. The real one works in Chrome, Brave and Edge, your tags are private by default, and page content never leaves your browser.</p>
              <Link href={signedIn ? "/dashboard" : "/signup"} className="mt-6 inline-flex items-center gap-2 rounded-md bg-accent px-5 py-3 font-medium text-accent-ink">{signedIn ? "Open dashboard" : "Start tagging, it's free"}<span className="cta-arrow" aria-hidden>→</span></Link>
              <p className="mt-6 flex gap-4 text-sm text-muted"><span>© {new Date().getFullYear()} TagAWallet</span><Link href="/privacy" className="hover:underline">Privacy</Link><Link href="/terms" className="hover:underline">Terms</Link></p>
            </div>
          )}
        </div>

        {/* Quest bar */}
        <div aria-live="polite" className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-t border-line bg-wash px-3 py-2 text-xs md:px-4">
          {QUEST.map((q, i) => <span key={q} className={done[i] ? "text-good line-through" : i === done.findIndex((d) => !d) ? "font-semibold text-ink" : "text-muted"}><span aria-hidden>{done[i] ? "✓" : `${i + 1}.`}</span> {q}</span>)}
          <span className="ml-auto text-muted">{count === QUEST.length ? <button type="button" className="font-semibold text-accent hover:underline" onClick={() => go("welcome")}>Open your new tab →</button> : "These sites are made up. Nothing leaves this page."}</span>
        </div>
      </main>
    </div>
  );
}
