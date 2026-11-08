"use client";
import { useEffect, useRef, useState } from "react";
import { Chip, Cta, FootLinks, NOT_A_WALLET, Reveal, ease, reducedMotion, seg } from "../shared";
import { PillNav, useSmoothProgress } from "../v3/kit";
import { Scene, TRAVEL, SWATCHES, YoursAudience, useTagMaker, type Tag } from "../v3/yours";

/* Compare + Yours. You tag the page in place. Comparing becomes a press-and-hold, and the wipe line carries you between sites. */

type Row = { from: string; fromTag?: { n: string; s: string; t: "good" | "warn" | "mine" }; to: string; toTag?: { n: string; s: string; t: "good" | "warn" | "mine" }; mine?: "from" | "to"; value: string };
const ROWS: Row[] = [
  { from: "0xb71a…40ce", fromTag: { n: "Exchange hot wallet", s: "Verified", t: "good" }, to: "0x4c1f…2c15", mine: "to", value: "1,204.5 ETH" },
  { from: "0x4c1f…2c15", mine: "from", to: "0x72ca…1e06", toTag: { n: "Market maker", s: "Shared", t: "warn" }, value: "88.0 ETH" },
  { from: "0x9e0b…77d1", fromTag: { n: "DAO treasury", s: "Shared", t: "warn" }, to: "0x4c1f…2c15", mine: "to", value: "310.2 ETH" },
  { from: "0x03fd…a98b", fromTag: { n: "My cold storage", s: "Private", t: "mine" }, to: "0xb71a…40ce", toTag: { n: "Exchange hot wallet", s: "Verified", t: "good" }, value: "12.0 ETH" },
];
const COLS = "grid grid-cols-2 md:grid-cols-[1.4fr_1.4fr_.6fr] items-center gap-3 px-4";

function MyTag({ tag }: { tag: Tag }) {
  const c = tag.swatch;
  return <span className="w-fit max-w-full truncate rounded-l-full rounded-r-md px-2.5 py-1 text-xs font-semibold shadow-sm md:text-sm" style={{ background: c.bg, color: c.fg, border: c.id === "cream" ? "1px solid #dfdbcf" : undefined }}>{tag.name || "Name it"}</span>;
}

function Table({ tagged, tag, editor }: { tagged: boolean; tag: Tag; editor?: React.ReactNode }) {
  let firstMine = true;
  const cell = (addr: string, t: Row["fromTag"], mine: boolean) => {
    if (mine) {
      const isFirst = firstMine; firstMine = false;
      if (!tagged) return isFirst && editor ? editor : <span className="addr truncate text-muted">{addr}</span>;
      return <MyTag tag={tag} />;
    }
    if (tagged && t) return <span className="truncate"><Chip name={t.n} source={t.s} tone={t.t} /></span>;
    return <span className="addr truncate text-muted">{addr}</span>;
  };
  return (
    <div className="bg-card text-sm">
      <div className={`${COLS} border-b border-line py-2.5 text-xs font-medium text-muted`}><span>From</span><span>To</span><span className="hidden md:block">Value</span></div>
      {ROWS.map((r) => (
        <div key={r.from + r.to} className={`${COLS} h-[60px] border-b border-line last:border-0`}>
          {cell(r.from, r.fromTag, r.mine === "from")}
          {cell(r.to, r.toTag, r.mine === "to")}
          <span className="hidden whitespace-nowrap md:block">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

function InPlace({ m }: { m: ReturnType<typeof useTagMaker> }) {
  const { tag, name, setName, setSwatch, swatch } = m;
  const named = useRef<HTMLDivElement>(null);
  const page = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const originRef = useRef({ x: "50%", y: "50%" });
  const [mode, setMode] = useState<"idle" | "typing" | "saved">("idle");
  const [holding, setHolding] = useState(false);
  const interacted = useRef(false);

  const open = (to: number, at: string) => {
    if (!named.current) return;
    named.current.style.clipPath = `circle(${to * 150}% ${at})`;
  };
  const wipe = (from: number, to: number, at: string, duration = 780) => {
    if (!named.current) return;
    if (reducedMotion()) { open(to, at); return; }
    named.current.animate([{ clipPath: `circle(${from * 150}% ${at})` }, { clipPath: `circle(${to * 150}% ${at})` }], { duration, easing: "cubic-bezier(.3,.8,.2,1)", fill: "forwards" }).onfinish = (e) => { open(to, at); (e.target as Animation).cancel(); };
  };

  const save = () => {
    const box = page.current!.getBoundingClientRect(), r = input.current?.getBoundingClientRect();
    if (r) originRef.current = { x: `${r.left - box.left + 40}px`, y: `${r.top - box.top + 16}px` };
    setMode("saved");
    wipe(0, 1, `at ${originRef.current.x} ${originRef.current.y}`);
  };

  // If nobody starts typing, the page types a name for them, once.
  useEffect(() => {
    if (reducedMotion()) { setMode("saved"); open(1, "at 50% 50%"); return; }
    setName("");
    const target = "Alice, OTC desk";
    let t1 = 0, t2 = 0;
    t1 = window.setTimeout(() => {
      if (interacted.current) return;
      setMode("typing");
      let n = 0;
      t2 = window.setInterval(() => {
        if (interacted.current) { clearInterval(t2); return; }
        n++;
        setName(target.slice(0, n));
        if (n >= target.length) { clearInterval(t2); t1 = window.setTimeout(() => { if (!interacted.current) save(); }, 650); }
      }, 75);
    }, 2600);
    return () => { clearTimeout(t1); clearInterval(t2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (mode === "typing" && interacted.current) input.current?.focus(); }, [mode]);

  const startHold = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setHolding(true);
    const box = page.current!.getBoundingClientRect();
    wipe(1, 0, `at ${box.width / 2}px ${box.height / 2}px`, 420);
  };
  const endHold = () => {
    if (!holding) return;
    setHolding(false);
    const box = page.current!.getBoundingClientRect();
    wipe(0, 1, `at ${box.width / 2}px ${box.height / 2}px`, 520);
  };

  const editor = mode === "idle" ? (
    <button type="button" onClick={() => { interacted.current = true; setName(""); setMode("typing"); }} className="pulse-tag w-fit whitespace-nowrap rounded-md border border-dashed border-accent bg-accent/10 px-2 py-1 text-xs font-medium text-accent">Tag this wallet</button>
  ) : mode === "typing" ? (
    <form onSubmit={(e) => { e.preventDefault(); interacted.current = true; if (!name.trim()) setName("My first tag"); save(); }} className="pop flex w-full max-w-[17rem] items-center gap-1 rounded-l-full rounded-r-md py-0.5 pl-3 pr-0.5 shadow-lg" style={{ background: swatch.bg, color: swatch.fg }}>
      <input ref={input} value={name} maxLength={28} aria-label="Name this wallet" placeholder="Name this wallet" onPointerDown={() => { interacted.current = true; }} onChange={(e) => { interacted.current = true; setName(e.target.value); }}
        className="min-w-0 flex-1 bg-transparent py-1 text-sm font-semibold outline-none placeholder:opacity-60" style={{ outline: "none" }} />
      <button className="rounded bg-black/25 px-2 py-1 text-xs font-medium text-white">Save ↵</button>
    </form>
  ) : null;

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-line shadow-2xl">
        <div className="flex items-center gap-2 border-b border-line bg-card px-4 py-2.5 text-xs text-muted">
          <span className="size-2.5 rounded-full bg-line" /><span className="size-2.5 rounded-full bg-line" /><span className="size-2.5 rounded-full bg-line" />
          <span className="ml-2">an explorer you already use</span>
        </div>
        <div ref={page} className="relative">
          <Table tagged={false} tag={tag} editor={editor} />
          <div ref={named} className="absolute inset-0" style={{ clipPath: "circle(0% at 50% 50%)", pointerEvents: mode === "saved" ? "auto" : "none" }} aria-hidden={mode !== "saved"}><Table tagged tag={tag} /></div>
        </div>
      </div>
      <div className="mt-4 flex min-h-11 flex-wrap items-center justify-between gap-3">
        {mode === "saved" ? (
          <div className="pop flex flex-wrap items-center gap-3">
            <button type="button" onPointerDown={startHold} onPointerUp={endHold} onPointerCancel={endHold} onLostPointerCapture={endHold} onKeyDown={(e) => { if (e.key === " " && !holding) { e.preventDefault(); setHolding(true); wipe(1, 0, "at 50% 50%", 420); } }} onKeyUp={(e) => { if (e.key === " " && holding) { setHolding(false); wipe(0, 1, "at 50% 50%", 520); } }}
              className={`touch-none select-none rounded-full border px-4 py-2 text-sm font-medium transition-all duration-150 ${holding ? "scale-95 border-accent bg-accent text-accent-ink" : "border-line bg-card hover:bg-wash"}`}>
              {holding ? "This is what you had before" : "Hold to see it without TagAWallet"}
            </button>
            <div role="radiogroup" aria-label="Tag color" className="flex gap-1.5">
              {SWATCHES.map((s) => <button key={s.id} type="button" role="radio" aria-checked={swatch.id === s.id} aria-label={s.id} onClick={() => setSwatch(s)} className={`size-6 rounded-full border border-[var(--muted)]/50 transition-transform hover:scale-110 ${swatch.id === s.id ? "ring-2 ring-accent ring-offset-2 ring-offset-paper" : ""}`} style={{ background: s.bg }} />)}
            </div>
          </div>
        ) : <p className="text-sm text-muted">Click the dashed label and name that wallet. It stays on this page.</p>}
      </div>
    </>
  );
}

/* The compare handle now moves you between sites as you scroll. */
function SiteWipe({ tag }: { tag: Tag }) {
  const root = useRef<HTMLElement>(null);
  const layers = useRef<(HTMLDivElement | null)[]>([]);
  const handle = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  useSmoothProgress(root, (p) => {
    const n = TRAVEL.length, at = p * (n - 1), from = Math.min(n - 2, Math.floor(at)), local = at - from;
    const k = ease(seg(local, 0.35, 0.95));
    setStep(k > 0.5 ? from + 1 : from);
    layers.current.forEach((el, i) => {
      if (!el) return;
      el.style.visibility = i <= from + 1 ? "visible" : "hidden";
      el.style.clipPath = i === from + 1 ? `inset(0 ${(1 - k) * 100}% 0 0)` : "none";
      el.style.zIndex = String(i);
    });
    if (handle.current) { handle.current.style.left = `${k * 100}%`; handle.current.style.opacity = k > 0.002 && k < 0.998 ? "1" : "0"; }
  });
  return (
    <section ref={root} className="h-[340vh]" aria-label="Your name on each site">
      <div className="sticky top-0 flex h-dvh flex-col items-center justify-center gap-5 px-4 pt-16 md:gap-7">
        <div key={step} className="pop text-center">
          <h2 className="text-3xl font-semibold tracking-tight md:text-6xl">{TRAVEL[step].title}</h2>
          <p className="mx-auto mt-2 max-w-lg text-muted md:text-lg">{TRAVEL[step].body}</p>
        </div>
        <div className="w-full max-w-4xl overflow-hidden rounded-2xl border border-line bg-card shadow-2xl">
          <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
            <span className="size-2.5 rounded-full bg-line" /><span className="size-2.5 rounded-full bg-line" /><span className="size-2.5 rounded-full bg-line" />
            <div className="ml-2 flex gap-1 text-xs">{TRAVEL.map((t, i) => <span key={t.id} className={`rounded-md px-2 py-1 font-medium transition-colors duration-300 ${step === i ? "bg-wash text-ink" : "text-muted"}`}>{t.id}</span>)}</div>
          </div>
          <div className="relative h-[320px] md:h-[350px]">
            {TRAVEL.map((t, i) => <div key={t.id} ref={(el) => { layers.current[i] = el; }} className="absolute inset-0 bg-card"><Scene i={i} tag={tag} live /></div>)}
            <div ref={handle} className="pointer-events-none absolute inset-y-0 z-10 w-0.5 -translate-x-1/2 bg-accent opacity-0" aria-hidden>
              <span className="absolute left-1/2 top-1/2 grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-accent text-sm font-medium text-accent-ink shadow-lg">⇆</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* Footer: the raw address wipes into the name you chose. */
function NameFooter({ tag, signedIn }: { tag: Tag; signedIn: boolean }) {
  const root = useRef<HTMLElement>(null);
  const top = useRef<HTMLDivElement>(null);
  const c = tag.swatch;
  useSmoothProgress(root, (p) => { if (top.current) top.current.style.clipPath = `inset(0 ${100 - ease(seg(p, 0.45, 1)) * 100}% 0 0)`; });
  return (
    <footer ref={root} className="overflow-hidden transition-colors duration-500" style={{ background: c.bg, color: c.fg }}>
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-end justify-between gap-6 px-5 pt-20">
        <div>
          <p className="text-3xl font-semibold tracking-tight md:text-5xl">Keep this one for real.</p>
          <div className="mt-5 [&>a]:!bg-[var(--f)] [&>a]:!text-[var(--b)]" style={{ "--f": c.fg, "--b": c.bg } as React.CSSProperties}><Cta signedIn={signedIn} /></div>
          <p className="mt-3 text-sm" style={{ color: c.sub }}>What you typed stayed on this page. Nothing was sent or saved.</p>
        </div>
        <FootLinks />
      </div>
      <div role="img" aria-label={tag.name || "Your tag"} className="relative mt-10 grid h-[17vw] min-h-24 place-items-center pb-16 md:pb-4">
        <span aria-hidden className="absolute whitespace-nowrap font-mono text-[10vw] leading-none opacity-40">0x4c1f…2c15</span>
        <div ref={top} aria-hidden className="absolute inset-0 grid place-items-center" style={{ background: c.bg }}>
          <span className="max-w-[96vw] truncate whitespace-nowrap font-semibold leading-none tracking-[-0.04em]" style={{ fontSize: `${Math.min(15, 150 / Math.max(10, (tag.name || "Your tag").length))}vw` }}>{tag.name || "Your tag"}</span>
        </div>
      </div>
    </footer>
  );
}

export function TryLanding({ signedIn }: { signedIn: boolean }) {
  const m = useTagMaker();
  return (
    <>
      <PillNav signedIn={signedIn} />
      <main>
        <section className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col justify-center px-4 pb-16 pt-24">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <h1 className="rise max-w-3xl text-[clamp(2.75rem,6.2vw,5.75rem)] font-semibold leading-[1] tracking-[-0.035em]">Know who&apos;s behind every wallet.</h1>
            <div className="rise" style={{ "--d": "120ms" } as React.CSSProperties}><Cta signedIn={signedIn} /></div>
          </div>
          <div className="rise mt-7" style={{ "--d": "220ms" } as React.CSSProperties}><InPlace m={m} /></div>
        </section>
        <SiteWipe tag={m.tag} />
        <YoursAudience tag={m.tag} />
        <section className="mx-auto w-full max-w-3xl px-5 pb-20 text-center"><Reveal><p className="text-muted">{NOT_A_WALLET}</p></Reveal></section>
      </main>
      <NameFooter tag={m.tag} signedIn={signedIn} />
    </>
  );
}
