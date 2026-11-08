"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { BrandMark } from "@/components/brand-mark";
import { reducedMotion } from "../shared";

/* The addresses are the design: huge, edge to edge, and the whole screen is the game. */

const ORANGE = "#EE6A42", DARK = "#D9552F", INK = "#1a1a18", PAPER = "#fbf8ef";
const HEX = "0123456789abcdef";
const TIMED_MS = 7000;
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

type Round = { target: string; rows: string[] };

// Seeded so the server and first client render match and the game is on screen straight away.
function makeRounds(seed: number): Round[] {
  let s = seed;
  const rnd = (n: number) => { s = (s * 1664525 + 1013904223) % 4294967296; return Math.floor((s / 4294967296) * n); };
  const hex = (n: number) => Array.from({ length: n }, () => HEX[rnd(16)]).join("");
  const target = `0x${hex(40)}`;
  const like = (keep: number) => `0x${target.slice(2, 2 + keep)}${hex(40 - keep * 2)}${target.slice(-keep)}`;
  return [[2, 2], [4, 3], [6, 4], [6, 4]].map(([keep, others]) => {
    const rows = Array.from({ length: others }, () => like(keep));
    rows.splice(rnd(others + 1), 0, target);
    return { target, rows };
  });
}

/** Characters settle left to right out of noise whenever `run` changes. */
function Scramble({ text, run }: { text: string; run: number }) {
  const [shown, setShown] = useState(text);
  useEffect(() => {
    if (reducedMotion()) { setShown(text); return; }
    const start = performance.now();
    const id = setInterval(() => {
      const n = Math.floor(((performance.now() - start) / 520) * text.length);
      if (n >= text.length) { setShown(text); clearInterval(id); return; }
      setShown(text.slice(0, n) + Array.from(text.slice(n), (c) => (c === "…" ? c : HEX[Math.floor(Math.random() * 16)])).join(""));
    }, 40);
    return () => clearInterval(id);
  }, [text, run]);
  return <>{shown}</>;
}

/** After an answer, only the characters that actually match her address stay solid. */
function Diff({ addr, target }: { addr: string; target: string }) {
  return <>{Array.from(addr, (c, k) => <span key={k} style={{ opacity: c === target[k] ? 1 : 0.28 }}>{c}</span>)}</>;
}

type Phase = "pick" | "memo" | "right" | "wrong" | "late" | "name" | "results";

function Game({ signedIn }: { signedIn: boolean }) {
  const [seed, setSeed] = useState(5);
  const [rounds, setRounds] = useState(() => makeRounds(5));
  const [i, setI] = useState(0);
  const [phase, setPhase] = useState<Phase>("pick");
  const [picked, setPicked] = useState<string | null>(null);
  const [right, setRight] = useState(0);
  const [times, setTimes] = useState<number[]>([]);
  const [namedMs, setNamedMs] = useState(0);
  const [draft, setDraft] = useState("");
  const [sweep, setSweep] = useState(-1);
  const [touched, setTouched] = useState(false);
  const drain = useRef<HTMLDivElement>(null);
  const started = useRef(0);
  const answered = useRef(false);
  const round = rounds[i];
  const name = draft.trim() || "Alice";
  const named = i === 3, isShort = i >= 2, timed = i > 0 && !named;
  const answering = phase === "pick";
  const href = signedIn ? "/dashboard" : "/signup";

  const answer = useCallback((addr: string | null) => {
    if (answered.current) return;
    answered.current = true;
    setTouched(true); setSweep(-1); setPicked(addr);
    const ok = addr === round.target, ms = performance.now() - started.current;
    if (named) setNamedMs(ms);
    else { setTimes((t) => [...t, ms]); if (ok) setRight((v) => v + 1); }
    setPhase(addr === null ? "late" : ok ? "right" : "wrong");
  }, [round, named]);

  useEffect(() => {
    if (phase === "memo") {
      const id = setTimeout(() => setPhase("pick"), 2200);
      return () => clearTimeout(id);
    }
    if (phase === "pick") {
      answered.current = false;
      started.current = performance.now();
      if (!timed) return;
      const anim = drain.current?.animate([{ transform: "scaleX(1)" }, { transform: "scaleX(0)" }], { duration: TIMED_MS, easing: "linear", fill: "forwards" });
      const id = setTimeout(() => answer(null), TIMED_MS);
      return () => { clearTimeout(id); anim?.cancel(); };
    }
    if (phase === "right" || phase === "wrong" || phase === "late") {
      const id = setTimeout(() => {
        setPicked(null);
        if (i === 0) { setI(1); setPhase("memo"); }
        else if (i === 1) { setI(2); setPhase("pick"); }
        else if (i === 2) { setI(3); setPhase("name"); }
        else setPhase("results");
      }, phase === "right" ? 1100 : 2200);
      return () => clearTimeout(id);
    }
  }, [phase, i, timed, answer]);

  // Until the first click, a highlight walks down the rows to show they're the thing to press.
  useEffect(() => {
    if (touched || i !== 0 || reducedMotion()) return;
    let k = 0, id = 0;
    const first = window.setTimeout(() => {
      id = window.setInterval(() => { setSweep(k % (round.rows.length + 2) < round.rows.length ? k % (round.rows.length + 2) : -1); k++; }, 420);
    }, 900);
    return () => { clearTimeout(first); clearInterval(id); };
  }, [touched, i, round]);

  useEffect(() => {
    if (phase !== "pick") return;
    const on = (e: KeyboardEvent) => { const n = Number(e.key); if (n >= 1 && n <= round.rows.length) answer(round.rows[n - 1]); };
    addEventListener("keydown", on);
    return () => removeEventListener("keydown", on);
  }, [phase, round, answer]);

  const restart = () => {
    const next = seed + 13;
    setSeed(next); setRounds(makeRounds(next)); setI(0); setPhase("pick"); setRight(0); setTimes([]); setNamedMs(0); setDraft("");
  };

  const prompt = phase === "wrong" ? (named ? `That wasn't ${name}.` : "Not her. On-chain, there's no undo.")
    : phase === "right" ? (named ? "No squinting." : "That's her.")
    : phase === "late" ? "Too slow, and still no idea who's who."
    : named ? `Now find ${name}.`
    : i === 0 ? "One of these is Alice's wallet. Click it."
    : i === 1 ? "Which one was hers?"
    : "They all look the same. That's how most wallets show them. Pick one.";

  const avg = times.length ? times.reduce((a, b) => a + b, 0) / times.length / 1000 : 0;

  return (
    <section className="relative flex h-dvh min-h-[560px] flex-col overflow-hidden" style={{ background: ORANGE, color: INK }}>
      {timed && answering && <div ref={drain} aria-hidden className="absolute inset-0 origin-left" style={{ background: DARK }} />}

      <header className="relative flex items-center justify-between gap-3 px-4 py-3 md:px-5">
        <span className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full" style={{ background: PAPER }}><BrandMark size={28} className="text-[#1a1a18]" /></span>
          <span className="truncate text-sm font-semibold md:text-base">TagAWallet <span className="hidden font-normal sm:inline">knows who&apos;s behind every wallet. You&apos;re about to see why that matters.</span></span>
        </span>
        <span className="flex shrink-0 items-center gap-4 text-sm font-medium">
          {phase !== "results" && <span aria-hidden className="hidden gap-1 md:flex">{[0, 1, 2, 3].map((k) => <span key={k} className="h-1.5 w-7 rounded-full" style={{ background: k <= i ? INK : "rgba(26,26,24,.2)" }} />)}</span>}
          <Link href={href} className="hover:underline">{signedIn ? "Dashboard" : "Skip"} →</Link>
        </span>
      </header>

      {phase === "memo" && (
        <div className="pop relative flex flex-1 flex-col justify-center px-4 pb-16 md:px-5">
          <p className="text-[clamp(2rem,5vw,4.5rem)] font-semibold leading-none tracking-[-0.035em]">Remember Alice&apos;s address.</p>
          <p className="lk-addr mt-6 break-all font-mono font-medium leading-tight" style={{ color: PAPER }}>{round.target}</p>
        </div>
      )}

      {phase === "name" && (
        <form className="pop relative flex flex-1 flex-col justify-center px-4 pb-16 md:px-5" onSubmit={(e) => { e.preventDefault(); setPhase("pick"); }}>
          <p className="lk-addr break-all font-mono font-medium leading-tight opacity-40">{round.target}</p>
          <label htmlFor="lk-name" className="mt-6 text-lg font-medium md:text-2xl">That was her all along. Stop reading it. What do you call her?</label>
          <input id="lk-name" autoFocus value={draft} maxLength={16} autoComplete="off" onChange={(e) => setDraft(e.target.value)} placeholder="Alice"
            className="mt-1 w-full border-b-4 bg-transparent pb-1 text-[clamp(3.5rem,13vw,12rem)] font-semibold leading-none tracking-[-0.04em] placeholder:text-black/30" style={{ borderColor: INK, outline: "none" }} />
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <button className="rounded-full px-8 py-4 text-xl font-semibold transition-transform duration-200 hover:scale-105 active:scale-95" style={{ background: INK, color: PAPER }}>Tag this wallet</button>
            <span className="text-sm">Then you&apos;ll play the last round with it.</span>
          </div>
        </form>
      )}

      {phase === "results" && (
        <div className="pop relative flex flex-1 flex-col justify-center px-4 pb-16 md:px-5">
          <h1 className="text-[clamp(3rem,9.5vw,9.5rem)] font-semibold leading-[.92] tracking-[-0.045em]">Know who&apos;s behind every wallet.</h1>
          <dl className="mt-6 flex flex-wrap gap-x-12 gap-y-3 md:mt-10">
            <div><dt className="text-sm font-medium">Reading addresses</dt><dd className="font-mono text-[clamp(2rem,5vw,4.5rem)] font-medium leading-none">{right}/3 · {avg.toFixed(1)}s</dd></div>
            <div><dt className="text-sm font-medium">Reading &ldquo;{name}&rdquo;</dt><dd className="font-mono text-[clamp(2rem,5vw,4.5rem)] font-medium leading-none" style={{ color: PAPER }}>{(namedMs / 1000).toFixed(1)}s</dd></div>
          </dl>
          <div className="mt-7 flex flex-wrap items-center gap-5 md:mt-10">
            <Link href={href} className="inline-flex items-center gap-3 rounded-full px-8 py-5 text-xl font-semibold transition-transform duration-200 hover:scale-105 active:scale-95" style={{ background: INK, color: PAPER }}>{signedIn ? "Open dashboard" : "Name your first wallet, free"}<span className="cta-arrow" aria-hidden>→</span></Link>
            <button type="button" onClick={restart} className="font-medium underline-offset-4 hover:underline">Play again</button>
          </div>
        </div>
      )}

      {(phase === "pick" || phase === "right" || phase === "wrong" || phase === "late") && (
        <div className="relative flex min-h-0 flex-1 flex-col pb-16">
          <p key={prompt} aria-live="polite" className="pop px-4 pb-3 pt-1 text-[clamp(1.6rem,4.2vw,3.75rem)] font-semibold leading-[1.02] tracking-[-0.035em] md:px-5">{prompt}</p>
          {i === 0 && (
            <div className="flex items-center gap-3 px-4 py-2 md:px-5" style={{ background: PAPER }}>
              <p className="lk-addr min-w-0 break-all font-mono font-medium leading-tight"><span className="sr-only">Alice&apos;s address: </span>{round.target}</p>
            </div>
          )}
          <ul key={i} className={`flex min-h-0 flex-1 flex-col ${phase === "wrong" ? "shake" : ""}`}>
            {round.rows.map((r, k) => {
              const isHer = r === round.target, done = !answering, hit = sweep === k;
              const label = named && isHer ? name : isShort ? short(r) : r;
              return (
                <li key={r} className="flex min-h-0 flex-1 border-t-2" style={{ borderColor: INK }}>
                  <button type="button" disabled={done} onClick={() => answer(r)} aria-label={label}
                    className={`group flex w-full items-center gap-4 px-4 text-left transition-colors duration-100 md:px-5 ${done ? "" : "cursor-pointer hover:bg-[#1a1a18] hover:text-[#fbf8ef] active:bg-[#1a1a18] active:text-[#fbf8ef]"}`}
                    style={{ ...(hit && !done ? { background: INK, color: PAPER } : {}), ...(done && isHer ? { background: PAPER } : {}), ...(done && picked === r && !isHer ? { background: INK, color: PAPER } : {}) }}>
                    <span className={`min-w-0 flex-1 break-all font-mono font-medium leading-[1.08] ${isShort ? "lk-short" : "lk-addr"}`}>
                      {named && isHer
                        ? <span className="stamp inline-block rounded-l-full rounded-r-2xl px-[.45em] font-sans font-semibold tracking-[-0.03em]" style={{ background: INK, color: PAPER }}>{name}</span>
                        : isShort ? <Scramble text={short(r)} run={i} />
                        : done ? <Diff addr={r} target={round.target} />
                        : <Scramble text={r} run={i} />}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

const FACTS = [
  ["Private by default", "Your tags are yours alone until you invite someone. No public feed of what you're researching."],
  ["One name, every wallet", "Group every address of a person, project, DAO or exchange across chains, with the links that back it up."],
  ["Every label shows its source", "Your private tag, a shared list, a self-claim or a verified profile. You always know who is saying what."],
  ["Where you already look", "Names appear next to addresses on explorers, X and trading tools you enable. Page content never leaves your browser."],
];

export function LookalikeBigLanding({ signedIn }: { signedIn: boolean }) {
  const href = signedIn ? "/dashboard" : "/signup";
  return (
    <div style={{ background: INK, color: PAPER }}>
      <main>
        <Game signedIn={signedIn} />
        <section className="px-4 py-24 md:px-5 md:py-36">
          <p className="max-w-[20ch] text-[clamp(2.5rem,7vw,7rem)] font-semibold leading-[.98] tracking-[-0.04em]">Attackers count on this. They send you tiny transfers from lookalike addresses and wait for you to copy one.</p>
          <p className="mt-8 max-w-2xl text-lg opacity-70">TagAWallet doesn&apos;t detect scams. It shows the names you trust, so a wallet with no name stands out. <a className="underline underline-offset-4" href="https://www.usenix.org/conference/usenixsecurity25/presentation/tsuchiya" rel="noreferrer noopener" target="_blank">Read the research on address poisoning</a>.</p>
        </section>
        <section>
          {FACTS.map(([t, b]) => (
            <div key={t} className="grid gap-2 border-t border-white/20 px-4 py-8 transition-colors duration-150 hover:bg-[#EE6A42] hover:text-[#1a1a18] md:grid-cols-2 md:gap-8 md:px-5 md:py-10">
              <h2 className="text-[clamp(1.75rem,3.6vw,3.5rem)] font-semibold leading-none tracking-[-0.03em]">{t}</h2>
              <p className="max-w-xl self-end text-lg opacity-80">{b}</p>
            </div>
          ))}
        </section>
      </main>
      <footer className="border-t border-white/20 px-4 pb-20 pt-10 md:px-5">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <Link href={href} className="inline-flex items-center gap-3 rounded-full px-8 py-5 text-xl font-semibold text-[#1a1a18] transition-transform duration-200 hover:scale-105 active:scale-95" style={{ background: ORANGE }}>{signedIn ? "Open dashboard" : "Name your first wallet, free"}<span className="cta-arrow" aria-hidden>→</span></Link>
            <p className="mt-5 max-w-xl text-sm opacity-60">TagAWallet is not a wallet. It holds no funds and will never ask for your seed phrase, private key or a transaction signature.</p>
          </div>
          <div className="flex gap-5 text-sm opacity-70"><span>© {new Date().getFullYear()} TagAWallet</span><Link href="/privacy" className="hover:underline">Privacy</Link><Link href="/terms" className="hover:underline">Terms</Link></div>
        </div>
      </footer>
    </div>
  );
}
