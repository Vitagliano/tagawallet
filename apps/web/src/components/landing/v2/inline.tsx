"use client";
import { useEffect, useRef, useState } from "react";
import { Chip, Cta, FootLinks, NOT_A_WALLET, Nav, POINTS, Reveal, reducedMotion, seg, useInView, useScrollProgress, type Tone } from "../shared";

const HEX = "0123456789abcdef";
const TONE_TEXT: Record<Tone, string> = { mine: "border-line bg-wash text-ink", good: "border-good/40 bg-good/10 text-good", warn: "border-warn/40 bg-warn/10 text-warn", accent: "border-accent/40 bg-accent/10 text-accent" };

/** An address that scrambles into a name when `on` flips. */
function Decode({ addr, name, tone, on }: { addr: string; name: string; tone: Tone; on: boolean }) {
  const [text, setText] = useState(addr);
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (reducedMotion()) { setText(on ? name : addr); setDone(on); return; }
    const target = on ? name : addr, start = performance.now();
    setDone(false);
    const id = setInterval(() => {
      const k = (performance.now() - start) / 520;
      if (k >= 1) { clearInterval(id); setText(target); setDone(on); return; }
      const n = Math.floor(target.length * k);
      setText(target.slice(0, n) + Array.from({ length: Math.min(target.length - n, 8) }, () => HEX[Math.floor(Math.random() * 16)]).join(""));
    }, 40);
    return () => clearInterval(id);
  }, [on, addr, name]);
  return (
    <span className={`inline-block whitespace-nowrap rounded-[.2em] border px-[.22em] align-baseline leading-[1.15] transition-colors duration-300 ${done ? TONE_TEXT[tone] : "addr border-transparent text-muted"}`} style={done ? undefined : { fontSize: "0.82em" }}>{text}</span>
  );
}

const SLOTS: { addr: string; name: string; tone: Tone }[] = [
  { addr: "0x7a25…488D", name: "Alice, OTC desk", tone: "mine" },
  { addr: "0x28C6…1d60", name: "an exchange", tone: "good" },
  { addr: "0x1f98…F984", name: "a DAO treasury", tone: "warn" },
  { addr: "0x9C7E…c8F9", name: "your cold storage", tone: "mine" },
  { addr: "0x2b1d…5d2b", name: "a grants multisig", tone: "accent" },
];

function Cycle() {
  const [i, setI] = useState(0);
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (reducedMotion()) { setOn(true); return; }
    const t = setTimeout(() => {
      if (on) { setOn(false); setI((v) => (v + 1) % SLOTS.length); } else setOn(true);
    }, on ? 2400 : 1100);
    return () => clearTimeout(t);
  }, [on]);
  const s = SLOTS[i];
  return <Decode key={i} addr={s.addr} name={s.name} tone={s.tone} on={on} />;
}

const STORY: ({ t: string } | { addr: string; name: string; tone: Tone; at: number })[] = [
  { t: "You open an explorer and see" }, { addr: "0x7a25…488D", name: "Alice, OTC desk", tone: "mine", at: 0.16 },
  { t: "paying" }, { addr: "0x1f98…F984", name: "a DAO treasury", tone: "warn", at: 0.34 },
  { t: "right after a transfer from" }, { addr: "0x28C6…1d60", name: "an exchange", tone: "good", at: 0.52 },
  { t: "and one more wallet you've never seen:" }, { addr: "0xdEAD…bEEF", name: "you just tagged it", tone: "accent", at: 0.72 },
];

function Narrative() {
  const root = useRef<HTMLElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const [p, setP] = useState(0);
  useScrollProgress(root, (v) => { setP(v); if (bar.current) bar.current.style.transform = `scaleX(${v})`; });
  return (
    <section ref={root} className="h-[320vh]" aria-label="What reading an explorer looks like with TagAWallet">
      <div className="sticky top-0 flex h-dvh flex-col justify-center">
        <div className="mx-auto w-full max-w-5xl px-4">
          <p className="text-3xl font-semibold leading-[1.45] tracking-tight md:text-6xl md:leading-[1.3]">
            {STORY.map((s, i) => "t" in s ? <span key={i}>{s.t} </span> : <span key={i}><Decode addr={s.addr} name={s.name} tone={s.tone} on={p >= s.at} /> </span>)}
          </p>
          <div className="mt-10 h-px w-full bg-line"><div ref={bar} className="h-px origin-left bg-accent" style={{ transform: "scaleX(0)" }} /></div>
          <p className={`mt-4 text-muted transition-opacity duration-500 md:text-lg ${seg(p, 0.82, 0.9) > 0.5 ? "opacity-100" : "opacity-0"}`}>Same page. Now you can read it.</p>
        </div>
      </div>
    </section>
  );
}

const ROW_CHIP: { name: string; source: string; tone: Tone }[] = [
  { name: "My cold storage", source: "Only you", tone: "mine" },
  { name: "Alice", source: "4 wallets", tone: "mine" },
  { name: "Exchange", source: "Verified", tone: "good" },
  { name: "DAO treasury", source: "On X", tone: "warn" },
];

function Rows() {
  const [open, setOpen] = useState(0);
  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-20">
      <ul className="border-t border-line">
        {POINTS.map((p, i) => (
          <li key={p.title} className="border-b border-line" onPointerEnter={(e) => { if (e.pointerType === "mouse") setOpen(i); }}>
            <button type="button" aria-expanded={open === i} onClick={() => setOpen(i)} className="w-full py-6 text-left">
              <span className="flex flex-wrap items-center justify-between gap-3">
                <span className={`text-3xl font-semibold tracking-tight transition-colors duration-300 md:text-5xl ${open === i ? "text-ink" : "text-muted/50"}`}>{p.title}</span>
                <Chip {...ROW_CHIP[i]} className={`transition-opacity duration-300 ${open === i ? "opacity-100" : "opacity-0"}`} />
              </span>
              <span className="grid transition-[grid-template-rows] duration-500 ease-out" style={{ gridTemplateRows: open === i ? "1fr" : "0fr" }}>
                <span className="overflow-hidden"><span className="block max-w-2xl pt-3 text-muted md:text-lg">{p.body}</span></span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function FooterLine() {
  const [ref, inView] = useInView<HTMLParagraphElement>(false);
  return (
    <p ref={ref} className="text-4xl font-semibold leading-[1.25] tracking-tight md:text-7xl md:leading-[1.2]">
      Next time you see <Decode addr="0x4f5c…3b0e" name="a name" tone="accent" on={inView} />, you&apos;ll know.
    </p>
  );
}

export function InlineLanding({ signedIn }: { signedIn: boolean }) {
  return (
    <>
      <Nav signedIn={signedIn} />
      <main>
        <section className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col justify-center px-4 pb-20 pt-24">
          <h1 aria-label="Know who's behind every wallet." className="text-5xl font-semibold leading-[1.18] tracking-tight md:text-8xl md:leading-[1.12]">
            <span aria-hidden>Know who&apos;s behind<br /><Cycle /></span>
          </h1>
          <p className="rise mt-7 max-w-xl text-muted md:text-lg" style={{ "--d": "150ms" } as React.CSSProperties}>Privately tag addresses, link socials, group related wallets, and recognize identities wherever you research and trade.</p>
          <div className="rise mt-6" style={{ "--d": "250ms" } as React.CSSProperties}><Cta signedIn={signedIn} /></div>
        </section>
        <Narrative />
        <Rows />
        <section className="mx-auto w-full max-w-5xl px-4 pb-16">
          <Reveal><p className="max-w-2xl text-muted">{NOT_A_WALLET}</p></Reveal>
        </section>
      </main>
      <footer className="border-t border-line">
        <div className="mx-auto w-full max-w-5xl px-4 pb-20 pt-16 md:pt-24">
          <FooterLine />
          <Cta signedIn={signedIn} className="mt-8" />
          <FootLinks className="mt-14 text-muted" />
        </div>
      </footer>
    </>
  );
}
