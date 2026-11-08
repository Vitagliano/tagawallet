"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Logo } from "@/components/ui";

/* The original Lookalike's look, without the start button: the first screen is already round one. */

const ROUND_MS = 6000;
const MEMO_MS = 2200;
const ROUNDS = 4;
const short = (a: string) => `${a.slice(0, 8)}…${a.slice(-6)}`;

type Round = { target: string; options: string[]; truncate: boolean; hint: string };

// Seeded so the server and first client render match and the game is on screen straight away.
function makeRounds(seed: number): Round[] {
  let s = seed;
  const rnd = (n: number) => { s = (s * 1664525 + 1013904223) % 4294967296; return Math.floor((s / 4294967296) * n); };
  const hex = (n: number) => Array.from({ length: n }, () => "0123456789abcdef"[rnd(16)]).join("");
  return [
    { keep: 2, truncate: false, hint: "Click the address that matches hers." },
    { keep: 4, truncate: false, hint: "From memory this time." },
    { keep: 6, truncate: false, hint: "Now the first and last six match." },
    { keep: 6, truncate: true, hint: "This is how most wallets actually show addresses." },
  ].map(({ keep, truncate, hint }) => {
    const head = hex(keep), tail = hex(keep);
    const make = () => `0x${head}${hex(40 - keep * 2)}${tail}`;
    const target = make();
    const options = [make(), make(), make()];
    options.splice(rnd(4), 0, target);
    return { target, options, truncate, hint };
  });
}

type Score = { right: number; total: number; ms: number };
type Phase = "memo" | "pick" | "hit" | "miss" | "bridge" | "results";
const EMPTY: Score = { right: 0, total: 0, ms: 0 };

function Game({ signedIn }: { signedIn: boolean }) {
  const [seed, setSeed] = useState(3);
  const [rounds, setRounds] = useState(() => makeRounds(3));
  const [phase, setPhase] = useState<Phase>("pick");
  const [tags, setTags] = useState(false);
  const [i, setI] = useState(0);
  const [plain, setPlain] = useState(EMPTY);
  const [tagged, setTagged] = useState(EMPTY);
  const [touched, setTouched] = useState(false);
  const bar = useRef<HTMLDivElement>(null);
  const started = useRef(0);
  const answered = useRef(false);
  const round = rounds[i];
  const href = signedIn ? "/dashboard" : "/signup";
  // Round one keeps her address on screen and has no clock, so everyone gets an easy start.
  const easy = i === 0 && !tags;

  const fresh = () => { const next = seed + 11; setSeed(next); setRounds(makeRounds(next)); setI(0); };

  const answer = useCallback((choice: string | null) => {
    if (answered.current) return;
    answered.current = true;
    setTouched(true);
    const ok = choice === round.target, ms = performance.now() - started.current;
    (tags ? setTagged : setPlain)((s) => ({ right: s.right + (ok ? 1 : 0), total: s.total + 1, ms: s.ms + ms }));
    setPhase(ok ? "hit" : "miss");
  }, [round, tags]);

  useEffect(() => {
    if (phase === "memo") {
      const id = setTimeout(() => setPhase("pick"), MEMO_MS);
      return () => clearTimeout(id);
    }
    if (phase === "pick") {
      answered.current = false;
      started.current = performance.now();
      if (easy) return;
      const anim = bar.current?.animate([{ transform: "scaleX(1)" }, { transform: "scaleX(0)" }], { duration: ROUND_MS, easing: "linear", fill: "forwards" });
      const id = setTimeout(() => answer(null), ROUND_MS);
      return () => { clearTimeout(id); anim?.cancel(); };
    }
    if (phase === "hit" || phase === "miss") {
      const id = setTimeout(() => {
        if (i + 1 < ROUNDS) { setI(i + 1); setPhase(tags ? "pick" : "memo"); }
        else setPhase(tags ? "results" : "bridge");
      }, phase === "miss" ? 1700 : 950);
      return () => clearTimeout(id);
    }
  }, [phase, i, tags, easy, answer]);

  useEffect(() => {
    if (phase !== "pick") return;
    const on = (e: KeyboardEvent) => { const n = Number(e.key); if (n >= 1 && n <= 4) answer(round.options[n - 1]); };
    addEventListener("keydown", on);
    return () => removeEventListener("keydown", on);
  }, [phase, round, answer]);

  const avg = (s: Score) => (s.total ? (s.ms / s.total / 1000).toFixed(1) : "0");
  const playing = phase === "memo" || phase === "pick" || phase === "hit" || phase === "miss";

  return (
    <section className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-5 py-4">
        <Logo className="text-lg" />
        <p aria-live="polite" className="hidden font-mono text-sm text-muted sm:block">{playing ? `${tags ? "Names on" : "Names off"} · ${i + 1} of ${ROUNDS}` : ""}</p>
        <Link href={href} className="text-sm font-medium hover:underline">{signedIn ? "Dashboard" : "Skip the game"}</Link>
      </header>

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-5 pb-20">
        {phase === "memo" && (
          <div key={i} className="pop text-center">
            <p className="text-sm font-medium text-accent">This is Alice. Remember it.</p>
            <p className="mt-4 break-all font-mono text-[clamp(1.1rem,3.2vw,2rem)] font-medium leading-snug">{round.truncate ? short(round.target) : round.target}</p>
          </div>
        )}

        {(phase === "pick" || phase === "hit" || phase === "miss") && (
          <div key={`${tags}-${i}`} className={phase === "miss" ? "shake" : ""}>
            <h1 className={`font-semibold tracking-[-0.04em] ${easy ? "text-[clamp(2.75rem,8vw,6.5rem)] leading-[.95]" : "text-[clamp(1.75rem,4vw,2.75rem)] leading-tight"}`}>{tags ? "Send to Alice." : "Which one is Alice?"}</h1>
            {easy && <p className="mt-3 text-sm text-muted md:text-base">You&apos;ve paid her before. Her address is in your history, next to three lookalikes.</p>}
            {easy && <p className="mt-4 break-all font-mono text-sm font-medium text-accent md:text-lg">{round.target}</p>}
            <p className="mt-2 text-lg font-medium md:text-xl">{tags ? "Same game. One thing changed." : round.hint}</p>
            {!easy && <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-line"><div ref={bar} className="h-full origin-left bg-accent" /></div>}
            <ul className="mt-4 space-y-2">
              {round.options.map((o, k) => {
                const isTarget = o === round.target, done = phase !== "pick";
                return (
                  <li key={o}>
                    <button type="button" disabled={done} onClick={() => answer(o)} aria-label={`${tags && isTarget ? "Alice, " : ""}${round.truncate ? short(o) : o}`}
                      className={`group flex min-h-14 w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all duration-150 ${done && isTarget ? "border-good bg-good/10" : done ? "border-line opacity-50" : `cursor-pointer border-line bg-card hover:-translate-y-0.5 hover:border-accent hover:shadow-md ${easy && !touched ? "pulse-tag" : ""}`}`}>
                      <span className="hidden w-5 font-mono text-xs text-muted md:block">{k + 1}</span>
                      <span className="min-w-0 flex-1 break-all font-mono text-[13px] md:text-base">{round.truncate ? short(o) : o}</span>
                      {tags && isTarget && <span className="stamp shrink-0 rounded-l-full rounded-r-md bg-[#EE6A42] px-3 py-1 text-sm font-semibold text-[#1a0d07]">Alice, OTC desk</span>}
                      {!done && <span aria-hidden className="shrink-0 text-lg text-muted transition-all duration-150 group-hover:translate-x-1 group-hover:text-accent">→</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
            <p aria-live="polite" className="mt-3 min-h-6 font-medium">
              {phase === "hit" && <span className="text-good">{tags ? "Easy." : "Good eye."}</span>}
              {phase === "miss" && !tags && <span className="text-bad">That one wasn&apos;t Alice, and on-chain there&apos;s no undo.</span>}
              {phase === "miss" && tags && <span className="text-bad">Look for her name.</span>}
            </p>
          </div>
        )}

        {phase === "bridge" && (
          <div className="pop">
            <p className="font-mono text-accent">{plain.right} of {plain.total} found · {avg(plain)}s each</p>
            <h2 className="mt-3 text-[clamp(2.5rem,7vw,5.5rem)] font-semibold leading-[1] tracking-[-0.035em]">Now give her a name.</h2>
            <p className="mt-4 max-w-xl text-lg text-muted">You never have to memorize another address. Tag it once, and the name shows up next to it from then on.</p>
            <button type="button" autoFocus onClick={() => { fresh(); setTags(true); setPhase("pick"); }} className="mt-7 inline-flex items-center gap-2 rounded-full bg-accent px-7 py-4 text-lg font-medium text-accent-ink transition-transform duration-200 hover:scale-[1.04] active:scale-95">Try it with names on<span className="cta-arrow" aria-hidden>→</span></button>
          </div>
        )}

        {phase === "results" && (
          <div className="pop">
            <h1 className="text-[clamp(2.75rem,7.5vw,6rem)] font-semibold leading-[.98] tracking-[-0.035em]">Know who&apos;s behind every wallet.</h1>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-line bg-card p-5"><p className="text-sm text-muted">Without names</p><p className="mt-1 text-5xl font-semibold tracking-tight">{plain.right}/{plain.total}</p><p className="mt-1 font-mono text-sm text-muted">{avg(plain)}s per address</p></div>
              <div className="rounded-2xl bg-[#EE6A42] p-5 text-[#1a0d07]"><p className="text-sm">With names</p><p className="mt-1 text-5xl font-semibold tracking-tight">{tagged.right}/{tagged.total}</p><p className="mt-1 font-mono text-sm">{avg(tagged)}s per address</p></div>
            </div>
            <div className="mt-7 flex flex-wrap items-center gap-4">
              <Link href={href} className="inline-flex items-center gap-2 rounded-full bg-accent px-7 py-4 text-lg font-medium text-accent-ink transition-transform duration-200 hover:scale-[1.04] active:scale-95">{signedIn ? "Open dashboard" : "Start tagging, it's free"}<span className="cta-arrow" aria-hidden>→</span></Link>
              <button type="button" onClick={() => { setPlain(EMPTY); setTagged(EMPTY); setTags(false); fresh(); setPhase("pick"); }} className="font-medium underline-offset-4 hover:underline">Play again</button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

const FACTS = [
  { title: "Private by default", body: "Your tags are yours alone until you invite someone. There is no public feed of what you're researching." },
  { title: "One name, every wallet", body: "Group every address of a person, project, DAO or exchange across chains, with the links that back it up." },
  { title: "Every label shows its source", body: "Your private tag, a shared list, a self-claim or a verified profile. You always know who is saying what." },
  { title: "Where you already look", body: "Names appear next to addresses on explorers, X and trading tools you enable. Page content never leaves your browser." },
];

export function Lookalike3Landing({ signedIn }: { signedIn: boolean }) {
  const href = signedIn ? "/dashboard" : "/signup";
  return (
    <>
      <main>
        <Game signedIn={signedIn} />
        <section className="bg-[#1a1a18] px-5 py-24 text-[#f6f4ee] md:py-36">
          <div className="mx-auto max-w-5xl">
            <p className="font-mono text-[#EE6A42]">This isn&apos;t only a game</p>
            <p className="mt-4 text-[clamp(2.25rem,5.5vw,4.75rem)] font-semibold leading-[1.05] tracking-[-0.03em]">Attackers send you tiny transfers from lookalike addresses, then wait for you to copy the wrong one.</p>
            <p className="mt-6 max-w-2xl text-[#b5b1a5]">TagAWallet doesn&apos;t detect scams. It shows the names you trust, so a wallet with no name stands out. <a className="underline underline-offset-4" href="https://www.usenix.org/conference/usenixsecurity25/presentation/tsuchiya" rel="noreferrer noopener" target="_blank">Read the research on address poisoning</a>.</p>
          </div>
        </section>
        <section className="mx-auto grid w-full max-w-5xl gap-x-10 gap-y-10 px-5 py-20 sm:grid-cols-2">
          {FACTS.map((f) => <div key={f.title}><h2 className="text-2xl font-semibold tracking-tight">{f.title}</h2><p className="mt-2 text-muted">{f.body}</p></div>)}
        </section>
      </main>
      <footer className="border-t border-line px-5 pb-20 pt-10 md:pb-10">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4">
          <div>
            <p className="max-w-xl text-sm text-muted">TagAWallet is not a wallet. It holds no funds and will never ask for your seed phrase, private key or a transaction signature.</p>
            <Link href={href} className="mt-3 inline-block font-medium text-accent hover:underline">{signedIn ? "Open dashboard" : "Start tagging, it's free"} →</Link>
          </div>
          <div className="flex gap-5 text-sm text-muted"><span>© {new Date().getFullYear()} TagAWallet</span><Link href="/privacy" className="hover:underline">Privacy</Link><Link href="/terms" className="hover:underline">Terms</Link></div>
        </div>
      </footer>
    </>
  );
}
