"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Logo } from "@/components/ui";

/* There is no start button. The page opens mid-task: Alice is waiting to be paid, and every row is a Send button. */

const ALICE = "0x4c1fA8e27B03d96E5f71aC28D04bE6637fA92c15";
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const ORANGE = "#EE6A42";

type Row = { addr: string; meta: string; dust?: boolean };
type Round = { line: string; hint: string; rows: Row[]; truncate: boolean; message: boolean; timed: boolean };

// Seeded so the server and the first client render match, and the game can be on screen immediately.
function makeRounds(seed: number): Round[] {
  let s = seed;
  const rnd = (n: number) => { s = (s * 1664525 + 1013904223) % 4294967296; return Math.floor((s / 4294967296) * n); };
  const hex = (n: number) => Array.from({ length: n }, () => "0123456789abcdef"[rnd(16)]).join("");
  const like = (head: number, tail: number) => `0x${ALICE.slice(2, 2 + head)}${hex(40 - head - tail)}${ALICE.slice(-tail)}`;
  const place = (rows: Row[], alice: Row, at: number) => [...rows.slice(0, at), alice, ...rows.slice(at)];
  const friend: Row = { addr: ALICE, meta: "You sent 1.2 ETH · 12 days ago" };
  return [
    {
      line: "Alice sent you her address. Find it below and send.", hint: "No rush on this one.", truncate: false, message: true, timed: false,
      rows: place([{ addr: like(3, 3), meta: "You sent 0.4 ETH · 2 months ago" }, { addr: like(3, 3), meta: "You sent 2.0 ETH · 3 months ago" }, { addr: like(3, 3), meta: "You sent 0.1 ETH · 5 months ago" }], friend, 2),
    },
    {
      line: "Pay her again. Her message has scrolled away.", hint: "Two new transfers just landed in your history.", truncate: false, message: false, timed: true,
      rows: place([{ addr: like(6, 6), meta: "Received 0.00 ETH · just now", dust: true }, { addr: like(6, 6), meta: "Received 0.00 ETH · just now", dust: true }, { addr: like(3, 3), meta: "You sent 0.4 ETH · 2 months ago" }], friend, 3),
    },
    {
      line: "One more. This is how most wallets show addresses.", hint: "Yes, they really do look identical.", truncate: true, message: false, timed: true,
      rows: place([{ addr: like(4, 4), meta: "Received 0.00 ETH · just now", dust: true }, { addr: like(4, 4), meta: "Received 0.00 ETH · 1 hour ago", dust: true }, { addr: like(4, 4), meta: "Received 0.00 ETH · 3 hours ago", dust: true }], friend, 1),
    },
    {
      line: "Now pay Alice with her name on it.", hint: "Same history. Same lookalikes.", truncate: true, message: false, timed: true,
      rows: place([{ addr: like(4, 4), meta: "Received 0.00 ETH · just now", dust: true }, { addr: like(4, 4), meta: "Received 0.00 ETH · just now", dust: true }, { addr: like(4, 4), meta: "Received 0.00 ETH · 1 hour ago", dust: true }], friend, 3),
    },
  ];
}

const TAG_ROUND = 3; // the round played with Alice's wallet named
const TIMED_MS = 9000;
const DUST_MS = 1100; // new transfers land before the clock starts
type Phase = "arrive" | "pick" | "right" | "wrong" | "late" | "tag" | "stamped" | "results";
type Outcome = "alice" | "stranger" | "late";

/** Marks how much of an address matches Alice's, so a wrong pick explains itself. */
function Marked({ addr }: { addr: string }) {
  if (addr === ALICE) return <>{addr}</>;
  let head = 0, tail = 0;
  while (head < addr.length && addr[head] === ALICE[head]) head++;
  while (tail < addr.length - head && addr[addr.length - 1 - tail] === ALICE[ALICE.length - 1 - tail]) tail++;
  return <><mark className="bg-accent/25 text-inherit">{addr.slice(0, head)}</mark>{addr.slice(head, addr.length - tail)}<mark className="bg-accent/25 text-inherit">{addr.slice(addr.length - tail)}</mark></>;
}

function SendScreen({ signedIn }: { signedIn: boolean }) {
  const [seed, setSeed] = useState(7);
  const [rounds, setRounds] = useState(() => makeRounds(7));
  const [i, setI] = useState(0);
  const [phase, setPhase] = useState<Phase>("pick");
  const [touched, setTouched] = useState(false);
  const [ledger, setLedger] = useState<Outcome[]>([]);
  const [idle, setIdle] = useState(false);
  const [copied, setCopied] = useState(false);
  const [plainMs, setPlainMs] = useState<number[]>([]);
  const [taggedMs, setTaggedMs] = useState<number | null>(null);
  const [taggedRight, setTaggedRight] = useState(false);
  const bar = useRef<HTMLDivElement>(null);
  const started = useRef(0);
  const answered = useRef(false);
  const round = rounds[i];
  const tagged = i === TAG_ROUND;
  const finished = phase === "results";

  const send = useCallback((addr: string | null) => {
    if (answered.current) return;
    answered.current = true;
    setTouched(true);
    const ok = addr === ALICE, ms = performance.now() - started.current;
    setIdle(false);
    setLedger((l) => [...l, addr === null ? "late" : ok ? "alice" : "stranger"]);
    if (tagged) { setTaggedMs(ms); setTaggedRight(ok); }
    else setPlainMs((m) => [...m, ms]);
    setPhase(addr === null ? "late" : ok ? "right" : "wrong");
  }, [tagged]);

  useEffect(() => {
    if (phase === "arrive") {
      const id = setTimeout(() => setPhase("pick"), DUST_MS);
      return () => clearTimeout(id);
    }
    if (phase === "stamped") {
      const id = setTimeout(() => { setI(TAG_ROUND); setPhase("arrive"); }, 1100);
      return () => clearTimeout(id);
    }
    if (phase === "pick") {
      answered.current = false;
      started.current = performance.now();
      if (!round.timed) {
        // Someone still looking after a while gets told exactly what to do.
        const id = setTimeout(() => setIdle(true), 7000);
        return () => clearTimeout(id);
      }
      const anim = bar.current?.animate([{ transform: "scaleX(1)" }, { transform: "scaleX(0)" }], { duration: TIMED_MS, easing: "linear", fill: "forwards" });
      const id = setTimeout(() => send(null), TIMED_MS);
      return () => { clearTimeout(id); anim?.cancel(); };
    }
    if (phase === "right" || phase === "wrong" || phase === "late") {
      const id = setTimeout(() => {
        if (i === TAG_ROUND) setPhase("results");
        else if (i === TAG_ROUND - 1) setPhase("tag");
        else { setI(i + 1); setPhase("arrive"); }
      }, phase === "right" ? 1300 : 2800);
      return () => clearTimeout(id);
    }
  }, [phase, i, round, send]);

  useEffect(() => {
    if (phase !== "pick") return;
    const on = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT") return;
      const n = Number(e.key);
      if (n >= 1 && n <= round.rows.length) send(round.rows[n - 1].addr);
    };
    addEventListener("keydown", on);
    return () => removeEventListener("keydown", on);
  }, [phase, round, send]);

  const restart = () => {
    const next = seed + 11;
    setSeed(next); setRounds(makeRounds(next)); setI(0); setPhase("pick");
    setLedger([]); setCopied(false); setIdle(false); setPlainMs([]); setTaggedMs(null); setTaggedRight(false);
  };

  const count = (o: Outcome) => ledger.filter((x) => x === o).length;
  const toAlice = count("alice"), toStrangers = count("stranger"), unsent = count("late");
  const plainRight = plainMs.length ? toAlice - (taggedRight ? 1 : 0) : 0;
  const avg = plainMs.length ? plainMs.reduce((a, b) => a + b, 0) / plainMs.length / 1000 : 0;
  const href = signedIn ? "/dashboard" : "/signup";

  const share = async () => {
    const text = `I sent ${toStrangers} of 4 ETH to strangers trying to find one address. Then I gave it a name and got it in ${((taggedMs ?? 0) / 1000).toFixed(1)}s. Try it: https://tagawallet.com`;
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { setCopied(false); }
  };

  const heading = finished ? (taggedRight ? "That's the difference a name makes." : "That's why names matter.")
    : phase === "tag" || phase === "stamped" ? "Now give her a name."
    : i === 0 ? "You owe Alice 1 ETH."
    : i === 1 ? "Pay Alice again."
    : tagged ? "Same wallet. Now it has a name."
    : "One more for Alice.";

  return (
    <section className="relative">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-4">
        <Logo className="text-lg" />
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/login" className="hover:underline">Sign in</Link>
          <Link href={href} className="rounded-md border border-line bg-card px-3 py-2 font-medium hover:bg-wash">{signedIn ? "Dashboard" : "Get started"}</Link>
        </nav>
      </header>

      <div className="mx-auto w-full max-w-6xl px-5">
        <h1 className="border-y border-line py-2 text-sm md:text-base"><span className="font-semibold">Know who&apos;s behind every wallet.</span> <span className="text-muted">Name any address, privately, and see it wherever you trade. Here&apos;s why it matters:</span></h1>
      </div>

      <div className="mx-auto grid w-full max-w-6xl items-start gap-6 px-5 pb-20 pt-1 md:min-h-[calc(100dvh-5rem)] md:grid-cols-[.8fr_1.2fr] md:items-center md:gap-12 md:pb-24 md:pt-8">
        {/* The words. On a phone these stay short so the Send buttons are on the first screen. */}
        <div>
          <h2 key={heading} className="pop text-[clamp(2.4rem,5.6vw,5rem)] font-semibold leading-[1] tracking-[-0.035em]">{heading}</h2>
          {!finished && phase !== "tag" && phase !== "stamped" && <p className="mt-3 text-lg md:mt-5 md:text-xl">{round.line}</p>}
          {!finished && phase !== "tag" && phase !== "stamped" && <p className="mt-1 hidden text-muted sm:block">{round.hint}</p>}
          {(phase === "tag" || phase === "stamped") && <p className="mt-3 text-lg md:mt-5 md:text-xl">You don&apos;t have to memorize her address again. Tag it once, and it&apos;s Alice from then on.</p>}
          {finished && <p className="mt-3 text-lg md:mt-5 md:text-xl">TagAWallet lets you privately name any address, and shows that name wherever you research and trade.</p>}
          {finished && (
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <Link href={href} className="inline-flex items-center gap-2 rounded-full bg-accent px-7 py-4 text-lg font-semibold text-accent-ink transition-transform duration-200 hover:scale-[1.04] active:scale-95">{signedIn ? "Open dashboard" : "Tag your first wallet, it's free"}<span className="cta-arrow" aria-hidden>→</span></Link>
              <button type="button" onClick={restart} className="font-medium underline-offset-4 hover:underline">Play again</button>
              <button type="button" onClick={share} className="font-medium underline-offset-4 hover:underline">{copied ? "Copied" : "Copy my score"}</button>
            </div>
          )}
          {!finished && (
            <div className="mt-5 hidden items-center gap-1.5 md:flex" aria-hidden>
              {[0, 1, 2, 3].map((k) => <span key={k} className={`h-1.5 w-10 rounded-full transition-colors duration-300 ${k < i || (k === i && (phase === "right" || phase === "wrong" || phase === "late")) ? "bg-accent" : k === i ? "bg-ink" : "bg-line"}`} />)}
            </div>
          )}
        </div>

        {/* The wallet. */}
        <div className="relative">
          {!touched && (
            <p className="pointer-events-none mb-2 flex items-center gap-2 text-base font-semibold text-accent md:absolute md:-top-11 md:left-1 md:mb-0 md:text-2xl md:tracking-tight" aria-hidden>
              <span className="inline-block animate-bounce text-xl">↓</span> Your move: tap the address you&apos;d pay
            </p>
          )}
          <div className="overflow-hidden rounded-3xl border border-line bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-line px-5 py-3">
              <span className="font-semibold">Send ETH</span>
              <span className="flex items-center gap-1.5" role="img" aria-label={`${4 - toAlice - toStrangers} of 4 ETH left`}>
                {[0, 1, 2, 3].map((k) => {
                  const o = ledger[k];
                  return <span key={k} className={`grid size-6 place-items-center rounded-full text-[11px] font-semibold transition-all duration-300 ${o === "alice" ? "bg-good text-paper" : o === "stranger" ? "bg-bad text-paper" : o === "late" ? "bg-line text-muted" : "bg-ink text-paper"}`}>{o === "alice" ? "A" : o === "stranger" ? "?" : o === "late" ? "–" : "Ξ"}</span>;
                })}
              </span>
            </div>
            {round.timed && phase !== "tag" && phase !== "stamped" && !finished && <div className="h-1 bg-line"><div key={i} ref={bar} className="h-full origin-left bg-accent" /></div>}

            {finished ? (
              <div className="pop p-5 md:p-6">
                <p className="text-sm font-medium text-muted">Where your 4 ETH went</p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-good/10 p-4"><p className="text-sm text-good">To Alice</p><p className="mt-1 text-4xl font-semibold tracking-tight text-good md:text-5xl">{toAlice} ETH</p></div>
                  <div className="rounded-2xl bg-bad/10 p-4"><p className="text-sm text-bad">To strangers</p><p className="mt-1 text-4xl font-semibold tracking-tight text-bad md:text-5xl">{toStrangers} ETH</p></div>
                </div>
                <dl className="mt-4 divide-y divide-line text-sm">
                  <div className="flex justify-between gap-3 py-2.5"><dt className="text-muted">Without a name</dt><dd className="font-mono">{plainRight} of {plainMs.length} right · {avg.toFixed(1)}s each</dd></div>
                  <div className="flex justify-between gap-3 py-2.5"><dt className="text-muted">With her name</dt><dd className="font-mono font-medium text-accent">{taggedRight ? "1 of 1" : "0 of 1"} right · {((taggedMs ?? 0) / 1000).toFixed(1)}s</dd></div>
                </dl>
                <p className="mt-2 text-xs text-muted">{unsent > 0 ? `${unsent} ETH never left, because time ran out. ` : ""}Made-up addresses, no real money.</p>
              </div>
            ) : phase === "tag" || phase === "stamped" ? (
              <div className="pop p-5 md:p-6">
                <p className="text-sm text-muted">{phase === "stamped" ? "Saved. Only you can see this." : "This was Alice all along:"}</p>
                {phase === "stamped" && <span className="stamp mt-3 inline-block rounded-l-full rounded-r-xl px-5 py-1.5 text-2xl font-semibold text-[#1a0d07]" style={{ background: ORANGE }}>Alice</span>}
                <p className="mt-2 break-all font-mono text-[15px] font-medium leading-snug">{ALICE}</p>
                {phase === "tag" && <button type="button" autoFocus onClick={() => setPhase("stamped")}
                  className="pulse-tag mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-4 text-lg font-semibold text-[#1a0d07] transition-transform duration-200 hover:scale-[1.02] active:scale-95" style={{ background: ORANGE }}>
                  Tag this wallet as &ldquo;Alice&rdquo;
                </button>}
                <p className="mt-3 text-center text-sm text-muted">{phase === "tag" ? "Then you'll send your last 1 ETH." : "Lookalikes won't have this name. Watch."}</p>
              </div>
            ) : (
              <>
                {round.message && (
                  <div className="flex gap-3 border-b border-line bg-wash px-4 py-3 md:px-5">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-sm font-semibold text-accent-ink" aria-hidden>A</span>
                    <p className="min-w-0 text-sm"><span className="font-semibold">Alice</span> <span className="text-muted">just now</span><br />Thanks! My address: <span className="break-all font-mono text-[13px] font-medium md:text-sm">{ALICE}</span></p>
                  </div>
                )}
                <p className="px-5 pb-1 pt-3 text-xs font-medium text-muted">Your recent history</p>
                <ul key={i} className={`space-y-2 px-3 pb-3 ${phase === "wrong" ? "shake" : ""}`}>
                  {round.rows.map((r, k) => {
                    const isAlice = r.addr === ALICE, done = phase !== "pick" && phase !== "arrive", waiting = phase === "arrive";
                    return (
                      <li key={r.addr} className={r.dust ? "pop" : ""} style={r.dust ? { animationDelay: `${k * 190 + 150}ms` } : undefined}>
                        <button type="button" disabled={done || waiting} onClick={() => send(r.addr)} aria-label={`Send 1 ETH to ${tagged && isAlice ? "Alice, " : ""}${round.truncate ? short(r.addr) : r.addr}`}
                          className={`group flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-all duration-150 md:px-4 md:py-3 ${done && isAlice ? "border-good bg-good/10" : done ? "border-line opacity-45" : "cursor-pointer border-line hover:-translate-y-0.5 hover:border-accent hover:bg-accent/5 hover:shadow-md active:translate-y-0"}`}>
                          <span className="min-w-0 flex-1">
                            {tagged && isAlice && <span className="stamp mb-1 inline-block rounded-l-full rounded-r-md px-3 py-0.5 text-sm font-semibold text-[#1a0d07]" style={{ background: ORANGE }}>Alice</span>}
                            <span className={`block break-all font-mono leading-snug ${round.truncate ? "text-base md:text-lg" : "text-[12.5px] md:text-[15px]"}`}>{round.truncate ? short(r.addr) : done ? <Marked addr={r.addr} /> : r.addr}</span>
                            <span className={`mt-0.5 block text-xs ${r.dust ? "text-warn" : "text-muted"}`}>{r.meta}</span>
                          </span>
                          <span className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-semibold transition-colors duration-150 ${done && isAlice ? "bg-good text-paper" : "bg-ink text-paper group-hover:bg-accent group-hover:text-accent-ink"} ${!touched && !done ? "pulse-tag" : ""}`}>{done && isAlice ? "Alice" : "Send"}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <p aria-live="polite" className="min-h-[4.25rem] border-t border-line px-5 py-3 text-sm font-medium">
                  {phase === "arrive" && <span className="pop inline-block text-warn">{i === 1 ? "New in your history: 2 transfers for 0.00 ETH." : "More 0.00 ETH transfers just landed."}</span>}
                  {phase === "pick" && (idle
                    ? <span className="pop inline-block text-accent">Stuck? Match Alice&apos;s address above to one of the rows, then press Send.</span>
                    : <span className="font-normal text-muted">{round.timed ? "Pick before the bar runs out." : "Every row is a real choice. There's no undo."}</span>)}
                  {phase === "late" && <span className="pop inline-block text-warn">Out of time. That ETH stays put, but you&apos;d still have to find her.</span>}
                  {phase === "right" && <span className="pop inline-block text-good">{tagged ? "Sent to Alice. No squinting." : "Sent to Alice. Good eye."}</span>}
                  {phase === "wrong" && <span className="pop inline-block text-bad">{tagged ? "So close. Look for her name." : round.truncate ? "Gone. The address looked exactly the same, and there's no undo." : "Gone. Only the highlighted parts matched Alice, and there's no undo."}</span>}
                </p>
              </>
            )}
          </div>
          <p className="mt-3 flex justify-center gap-4 text-center text-sm text-muted">
            {!finished && <span>A 30-second game. Made-up addresses, no real money.</span>}
            {!finished && <Link href={href} className="whitespace-nowrap font-medium hover:underline">Skip it</Link>}
          </p>
        </div>
      </div>
    </section>
  );
}

const STEPS = [
  { n: "1", title: "You pay someone", body: "Their real address is now in your transaction history." },
  { n: "2", title: "A lookalike sends you $0", body: "An attacker makes an address with the same start and end, and sends you a tiny transfer so it lands in your history too." },
  { n: "3", title: "You copy the wrong one", body: "Next time, you grab it from your history. The two look the same, and there's no undo." },
];

const FACTS = [
  { title: "Private by default", body: "Your tags are yours alone until you invite someone. There is no public feed of what you're researching." },
  { title: "One name, every wallet", body: "Group every address of a person, project, DAO or exchange across chains, with the links that back it up." },
  { title: "Every label shows its source", body: "Your private tag, a shared list, a self-claim or a verified profile. You always know who is saying what." },
  { title: "Where you already look", body: "Names appear next to addresses on explorers, X and trading tools you enable. Page content never leaves your browser." },
];

export function Lookalike2Landing({ signedIn }: { signedIn: boolean }) {
  const href = signedIn ? "/dashboard" : "/signup";
  return (
    <>
      <main>
        <SendScreen signedIn={signedIn} />
        <section className="bg-[#1a1a18] px-5 py-20 text-[#f6f4ee] md:py-28">
          <div className="mx-auto max-w-6xl">
            <p className="font-mono text-[#EE6A42]">Those $0 transfers weren&apos;t just for the game</p>
            <h2 className="mt-4 max-w-4xl text-[clamp(2.25rem,5vw,4.25rem)] font-semibold leading-[1.05] tracking-[-0.03em]">It&apos;s called address poisoning, and it works because addresses all look the same.</h2>
            <ol className="mt-10 grid gap-6 md:grid-cols-3">
              {STEPS.map((s) => <li key={s.n} className="rounded-2xl border border-white/15 p-6"><span className="font-mono text-[#EE6A42]">{s.n}</span><h3 className="mt-3 text-xl font-semibold">{s.title}</h3><p className="mt-2 text-[#b5b1a5]">{s.body}</p></li>)}
            </ol>
            <p className="mt-8 max-w-2xl text-[#b5b1a5]">TagAWallet doesn&apos;t detect scams. It shows the names you trust, so a wallet with no name stands out, whether it&apos;s an attack or just an honest mix-up. <a className="underline underline-offset-4" href="https://www.usenix.org/conference/usenixsecurity25/presentation/tsuchiya" rel="noreferrer noopener" target="_blank">Read the research on address poisoning</a>.</p>
          </div>
        </section>
        <section className="mx-auto w-full max-w-6xl px-5 py-20">
          <h2 className="max-w-3xl text-[clamp(2.25rem,5vw,4.25rem)] font-semibold leading-[1.02] tracking-[-0.03em]">Know who&apos;s behind every wallet.</h2>
          <div className="mt-10 grid gap-x-10 gap-y-9 sm:grid-cols-2">
            {FACTS.map((f) => <div key={f.title}><h3 className="text-2xl font-semibold tracking-tight">{f.title}</h3><p className="mt-2 text-muted">{f.body}</p></div>)}
          </div>
          <Link href={href} className="mt-10 inline-flex items-center gap-2 rounded-full bg-accent px-7 py-4 text-lg font-semibold text-accent-ink transition-transform duration-200 hover:scale-[1.04] active:scale-95">{signedIn ? "Open dashboard" : "Start tagging, it's free"}<span className="cta-arrow" aria-hidden>→</span></Link>
        </section>
      </main>
      <footer className="border-t border-line px-5 pb-20 pt-10 md:pb-10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <p className="max-w-xl text-sm text-muted">TagAWallet is not a wallet. It holds no funds and will never ask for your seed phrase, private key or a transaction signature.</p>
          <div className="flex gap-5 text-sm text-muted"><span>© {new Date().getFullYear()} TagAWallet</span><Link href="/privacy" className="hover:underline">Privacy</Link><Link href="/terms" className="hover:underline">Terms</Link></div>
        </div>
      </footer>
    </>
  );
}
