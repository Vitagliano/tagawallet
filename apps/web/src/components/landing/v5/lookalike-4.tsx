"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Logo } from "@/components/ui";
import { reducedMotion } from "../shared";

/* The feeling of the real thing: copy an address from a chat, pay, lose the message, reach for your history. */

const ALICE = "0x4c1fA8e27B03d96E5f71aC28D04bE6637fA92c15";
const FAKE_A = "0x4c1f7D90e3Ab52C18f6E04d9B7a1C35eD8602c15";
const FAKE_B = "0x4c1fE26b81dC4709A3f5B1e86D27c09aF4B72c15";
const FAKE_C = "0x4c1f03Ca95B7e1D64F28a7C0e3916dB5A82E2c15";
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const ORANGE = "#EE6A42";

type Msg = { from: string; text?: string; address?: boolean; mine?: boolean; day?: string };
type Row = { addr: string; meta: string; dust?: boolean; isNew?: boolean };
type Stage = "copy" | "paste" | "send" | "wait" | "history" | "ready" | "reveal" | "name" | "pay" | "payready" | "done";

const FLOOD: [string, string][] = [
  ["Tom", "anyone watching the market today?"], ["Mira", "trying not to"], ["Tom", "lol fair"], ["Dev", "who's in for friday"], ["Mira", "me"],
  ["Tom", "me too if it's not at that place again"], ["Dev", "what's wrong with that place"], ["Tom", "the fries"], ["Mira", "the fries were fine"], ["Dev", "ok new place then"],
  ["Mira", "did anyone read the governance thread"], ["Tom", "all 90 posts? no"], ["Dev", "tl;dr they want another vote"], ["Mira", "of course they do"], ["Tom", "gas is low btw"],
  ["Dev", "for now"], ["Mira", "friday at 8?"], ["Tom", "8 works"], ["Dev", "8:30"], ["Mira", "8:15, final offer"], ["Tom", "deal"], ["Dev", "fine"],
];

const COLOR: Record<string, string> = { Alice: ORANGE, Tom: "#2f6f9f", Mira: "#7b5bd6", Dev: "#1b7a4a" };

const STEP: Record<Stage, { title: string; sub: string }> = {
  copy: { title: "Alice needs 1 ETH.", sub: "Copy her address from the chat." },
  paste: { title: "Copied. Now pay her.", sub: "Paste it into your wallet." },
  send: { title: "Looks right.", sub: "Press Send." },
  wait: { title: "Done. Life goes on.", sub: "Two weeks of group chat coming up." },
  history: { title: "She needs another 1 ETH.", sub: "Her message is buried. Your wallet history is right there, so pick her address." },
  ready: { title: "Is that her?", sub: "Press Send when you're sure." },
  reveal: { title: "", sub: "" },
  name: { title: "Never squint again.", sub: "Name this wallet so you always know it's hers." },
  pay: { title: "One last payment.", sub: "Same history, same lookalikes. Find Alice." },
  payready: { title: "That was easy.", sub: "Press Send." },
  done: { title: "", sub: "" },
};

function Experience({ signedIn }: { signedIn: boolean }) {
  const [msgs, setMsgs] = useState<Msg[]>([{ from: "Alice", text: "Hey, can you send me that 1 ETH?" }]);
  const [stage, setStage] = useState<Stage>("copy");
  const [to, setTo] = useState("");
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [balance, setBalance] = useState(5);
  const [lost, setLost] = useState(0);
  const [firstWrong, setFirstWrong] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [name, setName] = useState("Alice");
  const [named, setNamed] = useState("");
  const [view, setView] = useState<"chat" | "wallet">("chat");
  const [unread, setUnread] = useState(0);
  const [toast, setToast] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  const href = signedIn ? "/dashboard" : "/signup";

  const after = useCallback((ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, reducedMotion() ? Math.min(ms, 30) : ms));
  }, []);
  const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  const say = useCallback((m: Msg) => {
    setMsgs((l) => [...l, m]);
    if (m.from === "Alice") { setToast(m.address ? "Alice sent an address" : m.text ?? ""); }
    setView((v) => { if (v === "wallet") setUnread((u) => u + 1); return v; });
  }, []);

  const begin = useCallback(() => {
    clear();
    setMsgs([{ from: "Alice", text: "Hey, can you send me that 1 ETH?" }]);
    setStage("copy"); setTo(""); setCopied(false); setSending(false); setBalance(5); setLost(0); setFirstWrong(null);
    setRows([]); setName("Alice"); setNamed(""); setView("chat"); setUnread(0); setToast("");
    after(700, () => say({ from: "Alice", address: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [after, say]);

  useEffect(() => { begin(); return clear; }, [begin]);

  useEffect(() => { const el = scroller.current; if (el) el.scrollTop = el.scrollHeight; }, [msgs, view]);

  const copy = () => {
    if (stage !== "copy" && stage !== "history") return;
    setCopied(true);
    navigator.clipboard?.writeText(ALICE).catch(() => {});
    if (stage === "copy") { setStage("paste"); setView("wallet"); }
  };

  const flood = () => {
    setStage("wait");
    after(1100, () => say({ from: "Alice", text: "Got it, thanks!" }));
    let t = 2100;
    after(t, () => { setView("chat"); say({ from: "", day: "2 weeks later" }); });
    FLOOD.forEach((f, k) => { t += 150; after(t, () => say({ from: f[0], text: f[1] })); });
    // The lookalikes land in the wallet while nobody's looking.
    after(2700, () => setRows((r) => [{ addr: FAKE_A, meta: "Received 0.00 ETH · 3 days ago", dust: true, isNew: true }, ...r]));
    after(3300, () => setRows((r) => [{ addr: FAKE_B, meta: "Sent 0.00 ETH · 1 day ago", dust: true, isNew: true }, ...r]));
    t += 700;
    after(t, () => say({ from: "Alice", text: "Hey! Can you send me another 1 ETH? Same address as last time." }));
    t += 1500;
    after(t, () => { setStage("history"); setCopied(false); setTo(""); setView("wallet"); setUnread(0); });
  };

  const send = () => {
    if (sending || !to) return;
    setSending(true);
    const ok = to === ALICE, was = stage;
    after(900, () => {
      setSending(false);
      setBalance((b) => Math.max(0, b - 1));
      if (!ok) setLost((v) => v + 1);
      setTo(""); setCopied(false);
      if (was === "send") {
        setRows([{ addr: ALICE, meta: "Sent 1 ETH · 2 weeks ago" }]);
        say({ from: "You", mine: true, text: "Sent!" });
        flood();
      } else if (was === "ready") {
        say({ from: "You", mine: true, text: "Sent!" });
        if (!ok) setFirstWrong(to);
        after(1100, () => {
          say({ from: "Alice", text: ok ? "Got it! Lucky you, half your history looks like me now." : "Hmm, nothing arrived. Which address did you use?" });
          after(700, () => { setStage("reveal"); setView("wallet"); });
        });
      } else {
        after(800, () => {
          say({ from: "Alice", text: ok ? "Perfect, we're square. Thank you!" : "Still nothing on my side…" });
          after(900, () => { if (ok) setStage("done"); else { setStage("pay"); } });
        });
      }
    });
  };

  const pick = (a: string) => {
    if (stage === "history" || stage === "ready") { setTo(a); setStage("ready"); }
    if (stage === "pay" || stage === "payready") { setTo(a); setStage("payready"); }
  };

  const paste = () => {
    if (!copied) return;
    setTo(ALICE);
    if (stage === "paste") setStage("send");
    if (stage === "history") setStage("ready");
  };

  const saveName = (e: React.FormEvent) => {
    e.preventDefault();
    setNamed(name.trim() || "Alice");
    setRows((r) => [{ addr: FAKE_C, meta: "Received 0.00 ETH · just now", dust: true, isNew: true }, ...r]);
    setStage("pay");
    after(500, () => say({ from: "Alice", text: "One more and we're square?" }));
  };

  const finished = stage === "done";
  const step = STEP[stage];
  const title = stage === "reveal" ? (firstWrong ? "That wasn't Alice." : "You found her. This time.") : step.title;
  const sub = stage === "reveal" ? (firstWrong ? "That 1 ETH is gone, and there's no undo." : "But look how close the others were.") : step.sub;
  const choosing = stage === "history" || stage === "ready" || stage === "pay" || stage === "payready";
  const compared = firstWrong ?? FAKE_A;

  return (
    <section className="flex h-dvh min-h-[680px] flex-col">
      <header className="mx-auto flex w-full max-w-6xl shrink-0 items-center justify-between px-5 py-3">
        <Logo className="text-lg" />
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/login" className="hover:underline">Sign in</Link>
          <Link href={href} className="font-medium hover:underline">{signedIn ? "Dashboard" : "Skip to sign up"}</Link>
        </nav>
      </header>

      <div className="mx-auto w-full max-w-6xl shrink-0 px-5 pb-4 pt-1">
        {finished ? (
          <div key="done" className="pop flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-[clamp(2rem,4.6vw,4rem)] font-semibold leading-[1] tracking-[-0.035em]">Know who&apos;s behind every wallet.</h1>
              <p className="mt-2 text-muted md:text-lg">Name any address, privately, and see that name wherever you research and trade.</p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <Link href={href} className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3.5 text-lg font-medium text-accent-ink transition-transform duration-200 hover:scale-[1.04] active:scale-95">{signedIn ? "Open dashboard" : "Start tagging, it's free"}<span className="cta-arrow" aria-hidden>→</span></Link>
              <button type="button" onClick={begin} className="font-medium underline-offset-4 hover:underline">Play again</button>
            </div>
          </div>
        ) : (
          <div key={stage} aria-live="polite" className="pop">
            <h1 className="text-[clamp(1.9rem,4.6vw,4rem)] font-semibold leading-[1.02] tracking-[-0.035em]">{title}</h1>
            <p className="mt-1 text-lg font-medium text-accent md:text-xl">{sub}</p>
          </div>
        )}
      </div>

      <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col px-3 pb-16 md:px-5">
        {/* On a phone these are two apps you switch between, which is part of the feeling. */}
        <div className="mb-2 flex gap-1 rounded-xl bg-wash p-1 text-sm font-medium md:hidden" role="tablist" aria-label="Apps">
          {(["chat", "wallet"] as const).map((v) => (
            <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => { setView(v); if (v === "chat") setUnread(0); }} className={`flex-1 rounded-lg py-2 capitalize ${view === v ? "bg-card shadow-sm" : "text-muted"}`}>
              {v}{v === "chat" && unread > 0 && <span className="ml-1.5 rounded-full bg-accent px-1.5 text-xs text-accent-ink">{unread}</span>}
            </button>
          ))}
        </div>

        <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] gap-3 md:grid-cols-[1.15fr_.85fr] md:gap-4">
          {/* Chat */}
          <div className={`min-h-0 flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-xl ${view === "chat" ? "flex" : "hidden md:flex"}`}>
            <div className="flex shrink-0 items-center gap-3 border-b border-line px-4 py-2.5">
              <span className="grid size-9 place-items-center rounded-full bg-wash text-sm font-semibold" aria-hidden>D</span>
              <div><p className="font-semibold leading-tight">Deals &amp; dinners</p><p className="text-xs text-muted">Alice, Mira, Tom, Dev</p></div>
            </div>
            <div ref={scroller} className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 py-3 md:px-4" tabIndex={0} aria-label="Group chat">
              {msgs.map((m, k) => {
                if (m.day) return <p key={k} className="pop py-2 text-center text-xs font-medium text-muted">{m.day}</p>;
                if (m.mine) return <p key={k} className="pop ml-auto w-fit rounded-2xl rounded-br-sm bg-accent px-3.5 py-2 text-accent-ink">{m.text}</p>;
                return (
                  <div key={k} className="pop w-fit max-w-[92%] rounded-2xl rounded-bl-sm bg-wash px-3.5 py-2">
                    <p className="text-xs font-semibold" style={{ color: COLOR[m.from] }}>{m.from}</p>
                    {m.address ? (
                      <button type="button" onClick={copy} aria-label="Copy Alice's address" className={`mt-1 block rounded-lg border border-line bg-card px-3 py-2 text-left transition-colors hover:border-accent ${stage === "copy" ? "pulse-tag border-accent" : ""}`}>
                        <span className="block break-all font-mono text-[13px] font-medium md:text-sm">{ALICE}</span>
                        <span className="mt-1 block text-xs font-semibold text-accent">{copied ? "Copied ✓" : "Tap to copy"}</span>
                      </button>
                    ) : <p>{m.text}</p>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Wallet */}
          <div className={`min-h-0 flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-xl ${view === "wallet" ? "flex" : "hidden md:flex"}`}>
            <div className="flex shrink-0 items-center justify-between border-b border-line px-4 py-2.5">
              <p className="font-semibold">Your wallet</p>
              <p className="font-mono text-sm"><span className="font-semibold">{balance}</span> ETH{lost > 0 && <span className="ml-2 text-bad">−{lost} lost</span>}</p>
            </div>
            {toast && <p key={toast} className="pop shrink-0 truncate border-b border-line bg-wash px-4 py-1.5 text-xs md:hidden"><span className="font-semibold">Alice:</span> {toast}</p>}
            <div className="min-h-0 flex-1 overflow-y-auto p-3 md:p-4">
              {stage === "reveal" ? (
                <div className="pop">
                  <p className="text-sm font-medium text-muted">{firstWrong ? "You paid:" : "A lookalike in your history:"}</p>
                  <p className="mt-1 break-all rounded-lg bg-bad/10 px-3 py-2 font-mono text-sm"><mark className="bg-transparent font-bold text-inherit">{compared.slice(0, 6)}</mark>{compared.slice(6, -4)}<mark className="bg-transparent font-bold text-inherit">{compared.slice(-4)}</mark></p>
                  <p className="mt-3 text-sm font-medium text-muted">Alice is:</p>
                  <p className="mt-1 break-all rounded-lg bg-good/10 px-3 py-2 font-mono text-sm"><mark className="bg-transparent font-bold text-inherit">{ALICE.slice(0, 6)}</mark>{ALICE.slice(6, -4)}<mark className="bg-transparent font-bold text-inherit">{ALICE.slice(-4)}</mark></p>
                  <p className="mt-3 text-sm text-muted">Same start, same end. People really do send tiny transfers from addresses like these, hoping you&apos;ll copy one from your history.</p>
                  <button type="button" autoFocus onClick={() => setStage("name")} className="pulse-tag mt-4 w-full rounded-xl bg-accent px-4 py-3 font-semibold text-accent-ink">Fix this for good</button>
                </div>
              ) : stage === "name" ? (
                <form onSubmit={saveName} className="pop">
                  <label htmlFor="l4-name" className="text-sm font-medium">Name <span className="font-mono">{short(ALICE)}</span></label>
                  <input id="l4-name" autoFocus value={name} maxLength={24} autoComplete="off" onChange={(e) => setName(e.target.value)} className="mt-2 w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-lg font-semibold" />
                  <p className="mt-2 text-sm text-muted">Only you can see this.</p>
                  <button className="pulse-tag mt-4 w-full rounded-xl px-4 py-3 font-semibold text-[#1a0d07]" style={{ background: ORANGE }}>Tag this wallet</button>
                </form>
              ) : (
                <>
                  <label className="text-xs font-medium text-muted" htmlFor="l4-to">Send 1 ETH to</label>
                  <div className={`mt-1 flex min-h-11 items-center gap-2 rounded-lg border bg-paper px-3 py-1.5 ${stage === "paste" ? "pulse-tag border-accent" : "border-line"}`}>
                    <output id="l4-to" className="min-w-0 flex-1 break-all font-mono text-[13px]">{to ? (named && to === ALICE ? <span className="font-sans font-semibold">{named}</span> : to) : <span className="text-muted">Recipient address</span>}</output>
                    {copied && !to && <button type="button" onClick={paste} className="shrink-0 rounded-md bg-ink px-3 py-1.5 text-sm font-semibold text-paper">Paste</button>}
                  </div>
                  <button type="button" onClick={send} disabled={!to || sending} className={`mt-2 w-full rounded-xl px-4 py-3 font-semibold transition-all duration-150 ${to ? "bg-accent text-accent-ink hover:brightness-105 active:scale-[.98]" : "bg-wash text-muted"} ${to && !sending ? "pulse-tag" : ""}`}>{sending ? "Sending…" : "Send 1 ETH"}</button>

                  <p className="mt-4 text-xs font-medium text-muted">History</p>
                  {rows.length === 0 && <p className="mt-2 text-sm text-muted">No transactions yet.</p>}
                  <ul className="mt-1.5 space-y-1.5">
                    {rows.map((r) => {
                      const isHer = r.addr === ALICE && !!named;
                      return (
                        <li key={r.addr} className={r.isNew ? "pop" : ""}>
                          <button type="button" disabled={!choosing} onClick={() => pick(r.addr)} aria-label={`Use ${isHer ? `${named}, ` : ""}${short(r.addr)}`}
                            className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition-all duration-150 ${to === r.addr ? "border-accent bg-accent/10" : "border-line"} ${choosing ? "cursor-pointer hover:-translate-y-0.5 hover:border-accent hover:shadow-md" : ""}`}>
                            <span className="min-w-0">
                              {isHer ? <span className="stamp inline-block rounded-l-full rounded-r-md px-3 py-0.5 font-semibold text-[#1a0d07]" style={{ background: ORANGE }}>{named}</span> : <span className="font-mono">{short(r.addr)}</span>}
                              <span className="block text-xs text-muted">{isHer && <span className="font-mono">{short(r.addr)} · </span>}{r.meta}</span>
                            </span>
                            {choosing && <span className="shrink-0 text-sm font-semibold text-accent">Use</span>}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </div>
          </div>
        </div>
        <p className="mt-2 text-center text-xs text-muted">A short demo. Made-up people and addresses, no real money.</p>
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

export function Lookalike4Landing({ signedIn }: { signedIn: boolean }) {
  const href = signedIn ? "/dashboard" : "/signup";
  return (
    <>
      <main>
        <Experience signedIn={signedIn} />
        <section className="mx-auto w-full max-w-6xl px-5 py-20">
          <h2 className="max-w-3xl text-[clamp(2.25rem,5vw,4.25rem)] font-semibold leading-[1.02] tracking-[-0.03em]">Know who&apos;s behind every wallet.</h2>
          <div className="mt-10 grid gap-x-10 gap-y-9 sm:grid-cols-2">
            {FACTS.map((f) => <div key={f.title}><h3 className="text-2xl font-semibold tracking-tight">{f.title}</h3><p className="mt-2 text-muted">{f.body}</p></div>)}
          </div>
          <Link href={href} className="mt-10 inline-flex items-center gap-2 rounded-full bg-accent px-7 py-4 text-lg font-medium text-accent-ink transition-transform duration-200 hover:scale-[1.04] active:scale-95">{signedIn ? "Open dashboard" : "Start tagging, it's free"}<span className="cta-arrow" aria-hidden>→</span></Link>
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
