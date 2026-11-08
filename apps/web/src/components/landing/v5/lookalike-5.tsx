"use client";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { BrandMark } from "@/components/brand-mark";
import { Logo } from "@/components/ui";
import { reducedMotion } from "../shared";

/* One moment at a time: a chat, a wallet that rises over it, and time passing. No app windows. */

const ALICE = "0x4c1fA8e27B03d96E5f71aC28D04bE6637fA92c15";
const FAKE_A = "0x4c1f7D90e3Ab52C18f6E04d9B7a1C35eD8602c15";
const FAKE_B = "0x4c1fE26b81dC4709A3f5B1e86D27c09aF4B72c15";
const FAKE_C = "0x4c1f03Ca95B7e1D64F28a7C0e3916dB5A82E2c15";
const FAKE_D = "0x4c1fB61f0A9c37E85d42C6b1A07e9F3dC51B2c15";
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const ORANGE = "#EE6A42";
const SHEET = "cubic-bezier(.18,1.1,.3,1)"; // a touch of overshoot, so the wallet has weight

type Msg = { from?: string; text?: string; address?: boolean; mine?: boolean; day?: string };
type Stage = "copy" | "open1" | "paste" | "typing" | "send1" | "away" | "time" | "open2" | "history" | "confirm" | "reply" | "reveal" | "history3" | "confirm3" | "finish" | "done";

const TIME: (Msg | { caption: string })[] = [
  { caption: "The next day" }, { day: "Tuesday" },
  { from: "Tom", text: "anyone watching the market today?" }, { from: "Mira", text: "trying not to" }, { from: "Tom", text: "lol fair" },
  { caption: "3 days later" }, { day: "Friday" },
  { from: "Dev", text: "who's in for friday" }, { from: "Mira", text: "me" }, { from: "Tom", text: "if it's not that place again" }, { from: "Dev", text: "what's wrong with that place" }, { from: "Tom", text: "the fries" },
  { caption: "1 week later" }, { day: "Last Monday" },
  { from: "Mira", text: "did anyone read the governance thread" }, { from: "Tom", text: "all 90 posts? no" }, { from: "Dev", text: "they want another vote" }, { from: "Mira", text: "of course they do" }, { from: "Tom", text: "gas is low btw" },
  { caption: "2 weeks later" }, { day: "Today" },
  { from: "Dev", text: "dinner again?" }, { from: "Mira", text: "8:15, final offer" }, { from: "Tom", text: "deal" },
];

const HISTORY: { addr: string; meta: string }[] = [
  { addr: FAKE_A, meta: "Received 0.01 ETH · 2 hours ago" },
  { addr: "0x91bE35a7C0d2E8f64B1a9D70c3E5f2A6b8D407d3", meta: "Sent 0.25 ETH · yesterday" },
  { addr: FAKE_B, meta: "Sent 0.01 ETH · 2 days ago" },
  { addr: "0xA07c92E1b4F6d3C805aE7b1D69f2C4a83E0Df1e8", meta: "Received 1.40 ETH · 4 days ago" },
  { addr: FAKE_C, meta: "Received 0.01 ETH · 5 days ago" },
  { addr: "0x3dC2f8A61e07B94dD5c2E3a17F60b98C4A2E68aa", meta: "Sent 0.10 ETH · 1 week ago" },
  { addr: ALICE, meta: "Sent 1.00 ETH · 2 weeks ago" },
  { addr: FAKE_D, meta: "Received 0.01 ETH · 2 weeks ago" },
  { addr: "0xfE1460aB7c3D92e18F5d0C6a47B1e93D2Ac8b920", meta: "Received 3.00 ETH · 1 month ago" },
];

const WORDS: Partial<Record<Stage, string>> = {
  copy: "Alice needs 1 ETH.",
  open1: "Copied.",
  paste: "Paste it.",
  typing: "Paste it.",
  send1: "Send it.",
  away: "Done.",
  open2: "Same address as before.",
  history: "Which one is it?",
  confirm: "You sure?",
  reply: "…",
  history3: "Now find her.",
  confirm3: "That's her.",
  finish: "…",
};

// If someone stalls, the big line tells them exactly what to do.
const NUDGE: Partial<Record<Stage, string>> = {
  copy: "Tap her address.",
  open1: "Open your wallet.",
  paste: "Tap the box to paste.",
  send1: "Press Send.",
  open2: "Open your wallet.",
  history: "Tap the one that's hers.",
  confirm: "Press Send.",
  history3: "Tap the one with her name.",
  confirm3: "Press Send.",
};

/** A small copy of the address travels between two points, so copy and paste feel physical. */
function flyAddress(from: DOMRect, to: DOMRect) {
  if (reducedMotion()) return;
  const pill = document.createElement("span");
  pill.textContent = short(ALICE);
  pill.setAttribute("aria-hidden", "true");
  pill.style.cssText = `position:fixed;left:0;top:0;z-index:60;padding:6px 14px;border-radius:999px;background:${ORANGE};color:#1a0d07;font:600 14px var(--font-jetbrains),monospace;pointer-events:none;white-space:nowrap`;
  document.body.appendChild(pill);
  const a = `translate(${from.left + from.width / 2 - 70}px, ${from.top + from.height / 2 - 16}px)`;
  const b = `translate(${to.left + to.width / 2 - 70}px, ${to.top + to.height / 2 - 16}px)`;
  const mid = `translate(${(from.left + to.left + (from.width + to.width) / 2) / 2 - 70}px, ${(from.top + to.top) / 2 - 46}px)`;
  pill.animate(
    [{ transform: `${a} scale(.7)`, opacity: 0 }, { transform: `${mid} scale(1.08)`, opacity: 1, offset: .45 }, { transform: `${b} scale(.82)`, opacity: 1, offset: .9 }, { transform: `${b} scale(.6)`, opacity: 0 }],
    { duration: 620, easing: "cubic-bezier(.3,.7,.2,1)" },
  ).onfinish = () => pill.remove();
}

/** Counts the balance down instead of swapping it. */
function useCounted(value: number) {
  const [shown, setShown] = useState(value);
  const current = useRef(value);
  useEffect(() => {
    if (reducedMotion()) { current.current = value; setShown(value); return; }
    const from = current.current, start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / 750), v = from + (value - from) * (1 - (1 - k) ** 3);
      current.current = v; setShown(v);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return shown;
}

export function Experience({ signedIn }: { signedIn: boolean }) {
  const [msgs, setMsgs] = useState<Msg[]>([{ from: "Alice", text: "Hey, can you send me that 1 ETH?" }]);
  const [stage, setStage] = useState<Stage>("copy");
  const [caption, setCaption] = useState("");
  const [typed, setTyped] = useState("");
  const [sent, setSent] = useState(false);
  const [balance, setBalance] = useState(5);
  const [picked, setPicked] = useState<string | null>(null);
  const [wrong, setWrong] = useState<string | null>(null);
  const [name, setName] = useState("Alice");
  const [named, setNamed] = useState("");
  const [nudge, setNudge] = useState<string | null>(null);
  const [fadeMiddle, setFadeMiddle] = useState(false);
  const [days, setDays] = useState(0);
  const [idle, setIdle] = useState(false);
  const shownBalance = useCounted(balance);
  const walletButton = useRef<HTMLButtonElement>(null);
  const field = useRef<HTMLButtonElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const lastH = useRef(0);
  const timers = useRef<number[]>([]);
  const href = signedIn ? "/dashboard" : "/signup";

  const after = useCallback((ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, reducedMotion() ? Math.min(ms, 40) : ms));
  }, []);
  const say = useCallback((m: Msg) => setMsgs((l) => [...l, m]), []);

  const begin = useCallback(() => {
    timers.current.forEach(clearTimeout); timers.current = [];
    lastH.current = 0;
    setMsgs([{ from: "Alice", text: "Hey, can you send me that 1 ETH?" }]);
    setStage("copy"); setCaption(""); setTyped(""); setSent(false); setBalance(5); setPicked(null); setWrong(null); setName("Alice"); setNamed(""); setNudge(null); setFadeMiddle(false); setDays(0);
    after(800, () => say({ from: "Alice", address: true }));
  }, [after, say]);

  useEffect(() => { begin(); return () => timers.current.forEach(clearTimeout); }, [begin]);

  // New messages push the old ones up smoothly. Additive, so quick bursts stack into one glide.
  useLayoutEffect(() => {
    const el = inner.current;
    if (!el) return;
    const h = el.offsetHeight, d = h - lastH.current;
    lastH.current = h;
    if (d > 0 && d < 400 && !reducedMotion()) el.animate([{ transform: `translateY(${d}px)` }, { transform: "translateY(0)" }], { duration: 480, easing: "cubic-bezier(.2,.8,.2,1)", composite: "add" });
  }, [msgs]);

  useEffect(() => {
    setIdle(false);
    if (!NUDGE[stage]) return;
    const id = window.setTimeout(() => setIdle(true), 6000);
    return () => clearTimeout(id);
  }, [stage]);

  // These moments must land on screen, even if the visitor has scrolled the page meanwhile.
  useEffect(() => {
    if (stage === "open2" || stage === "reveal" || stage === "done") scrollTo({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" });
  }, [stage]);

  const passTime = () => {
    setStage("time");
    let t = 500, n = 0;
    for (const item of TIME) {
      if ("caption" in item) { t += 500; const c = item.caption; after(t, () => { setCaption(c); setDays(c.startsWith("The next") ? 8 : c.startsWith("3") ? 28 : c.startsWith("1") ? 55 : 100); }); t += 260; continue; }
      // Starts unhurried, then the days blur.
      t += Math.max(120, 300 - n * 12); n++;
      after(t, () => say(item));
    }
    t += 1000;
    after(t, () => { setCaption(""); setDays(0); say({ from: "Alice", text: "Hey! Can you send me another 1 ETH? Same address as before." }); });
    after(t + 1100, () => setStage("open2"));
  };

  const copyAddress = () => {
    if (stage !== "copy") return;
    navigator.clipboard?.writeText(ALICE).catch(() => {});
    const from = document.querySelector('[aria-label="Copy Alice\'s address"]')!.getBoundingClientRect();
    setStage("open1");
    after(40, () => { if (walletButton.current) flyAddress(from, walletButton.current.getBoundingClientRect()); });
  };

  const paste = () => {
    if (stage !== "paste") return;
    setStage("typing");
    const box = field.current!.getBoundingClientRect();
    flyAddress(new DOMRect(innerWidth / 2 - 70, innerHeight - 90, 140, 32), box);
    let n = 0;
    const tick = () => {
      n += 2; setTyped(ALICE.slice(0, n));
      if (n < ALICE.length) after(16, tick); else after(180, () => setStage("send1"));
    };
    after(reducedMotion() ? 0 : 480, tick);
  };

  const sendFirst = () => {
    setSent(true); setBalance(4);
    after(1050, () => { setStage("away"); setSent(false); setTyped(""); });
    after(1500, () => say({ from: "You", mine: true, text: "Sent!" }));
    after(2300, () => say({ from: "Alice", text: "Got it, thanks!" }));
    after(3300, passTime);
  };

  const sendPicked = () => {
    const ok = picked === ALICE, third = stage === "confirm3";
    setSent(true); setBalance((b) => b - 1);
    after(1050, () => { setStage(third ? "finish" : "reply"); setSent(false); });
    if (!ok) setWrong(picked);
    after(1500, () => say({ from: "You", mine: true, text: "Sent!" }));
    after(2500, () => say({ from: "Alice", text: third ? "Perfect, we're square. Thank you!" : ok ? "Got it! Lucky, half your history looks like me now." : "Hmm, nothing arrived. Which address did you use?" }));
    after(third ? 4200 : 4400, () => { setPicked(null); setStage(third ? "done" : "reveal"); });
    if (!third) after(5400, () => setFadeMiddle(true));
  };

  const pick = (a: string) => {
    if (stage === "history" || stage === "confirm") { setPicked(a); setStage("confirm"); }
    if (stage === "history3" || stage === "confirm3") {
      if (a !== ALICE) { setNudge(a); after(600, () => setNudge(null)); return; }
      setPicked(a); setStage("confirm3");
    }
  };

  const saveName = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = name.trim() || "Alice";
    setStage("history3");
    // The wallet rises first, then the name lands and everything else recedes.
    after(650, () => setNamed(clean));
  };

  const sheetUp = ["paste", "typing", "send1", "history", "confirm", "history3", "confirm3"].includes(stage);
  const showHistory = ["history", "confirm", "history3", "confirm3"].includes(stage);
  const done = stage === "done", reveal = stage === "reveal";
  const compared = wrong ?? FAKE_A;
  const words = sent ? "Sent." : caption || (idle && NUDGE[stage]) || WORDS[stage] || "";

  return (
    <section className="relative flex h-dvh min-h-[640px] flex-col overflow-hidden">
      <header className="relative z-30 flex shrink-0 items-center justify-between px-5 py-4">
        <span className="flex items-center gap-4"><Logo className="text-lg" /><span className="hidden text-sm text-muted lg:inline">Know who&apos;s behind every wallet.</span></span>
        <Link href={href} className="text-sm font-medium hover:underline">{signedIn ? "Dashboard" : "Skip to sign up"}</Link>
      </header>

      {!done && !reveal && (
        <div className="relative z-0 flex h-[clamp(4.5rem,13vh,8rem)] shrink-0 items-center justify-center px-5 text-center">
          <p key={words} aria-live="polite" className="caption-in text-[clamp(2.25rem,6.5vw,5rem)] font-semibold leading-none tracking-[-0.04em]">{words}</p>
          <span aria-hidden className={`absolute bottom-0 left-1/2 h-1 w-40 -translate-x-1/2 overflow-hidden rounded-full bg-line transition-opacity duration-500 ${stage === "time" && days > 0 ? "opacity-100" : "opacity-0"}`}><span className="block h-full rounded-full bg-accent transition-[width] duration-700 ease-out" style={{ width: `${days}%` }} /></span>
        </div>
      )}

      {/* The chat is the world. It sits back when the wallet rises over it. */}
      <div className={`relative mx-auto min-h-0 w-full max-w-xl flex-1 px-4 transition-opacity duration-500 motion-reduce:transition-none ${done || reveal ? "opacity-0" : ""}`}>
        <div className="absolute inset-x-4 bottom-[8.5rem] top-0 flex flex-col justify-end overflow-hidden transition-all duration-700" style={{ transitionTimingFunction: SHEET, transform: sheetUp ? "scale(.93) translateY(-14px)" : "none", opacity: sheetUp ? 0.35 : 1, maskImage: "linear-gradient(transparent, #000 22%)" }}>
          <div ref={inner} className="space-y-2">
            {msgs.map((m, k) => {
              if (m.day) return <p key={k} className="bubble-in py-3 text-center text-sm font-medium text-muted">{m.day}</p>;
              if (m.mine) return <p key={k} className="bubble-in origin-bottom-right ml-auto w-fit rounded-[1.4rem] rounded-br-md bg-accent px-4 py-2.5 text-lg text-accent-ink">{m.text}</p>;
              return (
                <div key={k} className="bubble-in origin-bottom-left w-fit max-w-[94%] rounded-[1.4rem] rounded-bl-md bg-wash px-4 py-2.5 text-lg leading-snug">
                  {m.from !== "Alice" && <p className="text-xs font-semibold text-muted">{m.from}</p>}
                  {m.address ? (
                    <button type="button" onClick={copyAddress} aria-label="Copy Alice's address" className={`block rounded-2xl text-left ${stage === "copy" ? "pulse-tag" : ""}`}>
                      <span className="block break-all font-mono text-[15px] font-medium leading-snug md:text-base">{ALICE}</span>
                      <span className="mt-1 block text-sm font-semibold text-accent">{stage === "copy" ? "Tap to copy" : "Copied ✓"}</span>
                    </button>
                  ) : m.text}
                </div>
              );
            })}
          </div>
        </div>

        {(stage === "open1" || stage === "open2") && (
          <div className="pop absolute inset-x-0 bottom-[4.5rem] z-10 flex justify-center">
            <button ref={walletButton} type="button" autoFocus onClick={() => setStage(stage === "open1" ? "paste" : "history")} className="pulse-tag rounded-full bg-ink px-7 py-3.5 text-lg font-semibold text-paper transition-transform duration-200 hover:scale-105 active:scale-95">Open your wallet</button>
          </div>
        )}

        {/* The wallet rises from the bottom edge of the screen. */}
        <div aria-hidden={!sheetUp} className={`absolute inset-x-2 -bottom-6 top-0 z-20 flex flex-col overflow-hidden rounded-t-[2rem] border border-b-0 border-line bg-card shadow-[0_-30px_80px_-20px_rgba(0,0,0,.35)] transition-transform duration-700 ${sheetUp ? "" : "pointer-events-none invisible"}`} style={{ transform: sheetUp ? "translateY(0)" : "translateY(106%)", transitionTimingFunction: SHEET, visibility: sheetUp || stage === "away" || stage === "reply" || stage === "time" || stage === "finish" ? "visible" : undefined }}>
          <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-line" aria-hidden />
          <div className="shrink-0 px-5 pb-2 pt-3 text-center">
            <p className="text-4xl font-semibold tabular-nums tracking-tight">{shownBalance.toFixed(2)} <span className="text-muted">ETH</span></p>
          </div>

          {sent ? (
            <div className="grid flex-1 place-items-center pb-20">
              <svg viewBox="0 0 64 64" className="size-24" fill="none" stroke={ORANGE} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" aria-label="Sent"><circle cx="32" cy="32" r="28" className="draw-line" /><path d="M20 33l9 9 16-18" className="draw-line" style={{ animationDelay: "200ms" }} /></svg>
            </div>
          ) : showHistory ? (
            <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-44">
              <ul className="divide-y divide-line">
                {HISTORY.map((r, k) => {
                  const her = !!named && r.addr === ALICE, on = picked === r.addr;
                  return (
                    <li key={r.addr} className={`rise ${nudge === r.addr ? "shake" : ""}`} style={{ "--d": `${named ? 0 : k * 70 + 200}ms` } as React.CSSProperties}>
                      <button type="button" onClick={() => pick(r.addr)} aria-label={`${her ? `${named}, ` : ""}${short(r.addr)}, ${r.meta}`} className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-500 ${on ? "scale-[1.02] bg-accent/10" : "hover:bg-wash"} ${named && !her ? "opacity-35" : picked && !on ? "opacity-60" : ""}`} style={{ transitionDelay: named && !her && !picked ? `${k * 35}ms` : "0ms" }}>
                        <span className="min-w-0">
                          {her ? <span className="stamp mb-0.5 inline-block rounded-l-full rounded-r-md px-3 py-0.5 font-semibold text-[#1a0d07]" style={{ background: ORANGE }}>{named}</span> : <span className="block font-mono text-[15px]">{short(r.addr)}</span>}
                          <span className="block text-xs text-muted">{r.meta}</span>
                        </span>
                        {on && <span className="pop shrink-0 text-sm font-semibold text-accent">Selected</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <div className="flex-1 px-5 pt-5">
              <button ref={field} type="button" onClick={paste} disabled={stage !== "paste"} aria-label="Paste address" className={`min-h-20 w-full break-all rounded-2xl border px-4 py-3 text-left font-mono text-[15px] leading-snug ${stage === "paste" ? "pulse-tag border-accent" : "border-line"}`}>
                {typed || <span className="font-sans text-lg font-semibold text-accent">Tap to paste</span>}
              </button>
            </div>
          )}

          {(stage === "send1" || stage === "confirm" || stage === "confirm3") && !sent && (
            <div className="pop absolute inset-x-4 bottom-[6rem] z-10">
              <button type="button" autoFocus onClick={stage === "send1" ? sendFirst : sendPicked} className="pulse-tag w-full rounded-full bg-accent py-4 text-lg font-semibold text-accent-ink shadow-xl transition-transform duration-200 hover:scale-[1.02] active:scale-95">Send 1 ETH</button>
            </div>
          )}
        </div>
      </div>

      {/* Same start, same end: the middles fall away and leave what you actually compared. */}
      {reveal && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center px-5 pb-16 pt-16 text-center">
          <h2 className="pop text-[clamp(2.5rem,7vw,5.5rem)] font-semibold leading-none tracking-[-0.04em]">{wrong ? "That wasn't Alice." : "You found her. This time."}</h2>
          <div className="pop mt-8 space-y-3 text-left font-mono text-[clamp(11.5px,3.3vw,22px)]" style={{ animationDelay: "250ms" }}>
            {[compared, ALICE].map((a, k) => (
              <p key={k} className="whitespace-nowrap">
                <span className={`rounded-sm font-bold text-accent transition-colors duration-700 ${fadeMiddle ? "bg-accent/15" : ""}`}>{a.slice(0, 6)}</span>
                <span className="transition-opacity duration-1000" style={{ opacity: fadeMiddle ? 0.14 : 1 }}>{a.slice(6, -4)}</span>
                <span className={`rounded-sm font-bold text-accent transition-colors duration-700 ${fadeMiddle ? "bg-accent/15" : ""}`}>{a.slice(-4)}</span>
              </p>
            ))}
          </div>
          <p className={`mt-6 max-w-md text-lg text-muted transition-opacity duration-700 ${fadeMiddle ? "opacity-100" : "opacity-0"}`}>{wrong ? "That 1 ETH is gone. " : ""}Same start, same end. Those tiny transfers put it in your history on purpose.</p>
          <form onSubmit={saveName} className={`mt-6 flex w-full max-w-sm items-center gap-2 rounded-l-full rounded-r-2xl py-1.5 pl-5 pr-1.5 transition-all duration-700 ${fadeMiddle ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"}`} style={{ background: ORANGE }}>
            <input aria-label="Name this wallet" value={name} maxLength={20} autoComplete="off" onChange={(e) => setName(e.target.value)} className="min-w-0 flex-1 bg-transparent text-xl font-semibold text-[#1a0d07] outline-none" style={{ outline: "none" }} tabIndex={fadeMiddle ? 0 : -1} />
            <button tabIndex={fadeMiddle ? 0 : -1} className="shrink-0 rounded-xl bg-[#1a0d07] px-4 py-2.5 font-semibold text-white active:scale-95">Tag her wallet</button>
          </form>
        </div>
      )}

      {done && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center px-5 pb-16 text-center">
          <span className="stamp mb-6 block"><BrandMark size={92} /></span>
          <h1 aria-label="Know who's behind every wallet." className="max-w-5xl text-[clamp(3rem,9vw,8rem)] font-semibold leading-[1] tracking-[-0.04em]">
            {"Know who's behind every wallet.".split(" ").map((w, k) => <span key={k} aria-hidden className="inline-block overflow-hidden pb-[.12em] align-bottom"><span className="word-rise pr-[.24em]" style={{ "--d": `${250 + k * 70}ms` } as React.CSSProperties}>{w}</span></span>)}
          </h1>
          <p className="rise mt-6 max-w-xl text-lg text-muted md:text-xl" style={{ "--d": "700ms" } as React.CSSProperties}>Name any address, privately, and see that name wherever you research and trade.</p>
          <div className="rise mt-7 flex flex-wrap items-center justify-center gap-5" style={{ "--d": "850ms" } as React.CSSProperties}>
            <Link href={href} className="inline-flex items-center gap-2 rounded-full bg-accent px-7 py-4 text-lg font-medium text-accent-ink transition-transform duration-200 hover:scale-[1.04] active:scale-95">{signedIn ? "Open dashboard" : "Start tagging, it's free"}<span className="cta-arrow" aria-hidden>→</span></Link>
            <button type="button" onClick={begin} className="font-medium underline-offset-4 hover:underline">Play again</button>
          </div>
        </div>
      )}
    </section>
  );
}

const FACTS = [
  { title: "Private by default", body: "Your tags are yours alone until you invite someone. There is no public feed of what you're researching." },
  { title: "One name, every wallet", body: "Group every address of a person, project, DAO or exchange across chains, with the links that back it up." },
  { title: "Every label shows its source", body: "Your private tag, a shared list, a self-claim or a verified profile. You always know who is saying what." },
  { title: "Where you already look", body: "Names appear next to addresses on explorers, X and trading tools you enable. Page content never leaves your browser." },
];

export function Lookalike5Landing({ signedIn }: { signedIn: boolean }) {
  return (
    <>
      <main>
        <Experience signedIn={signedIn} />
        <section className="mx-auto grid w-full max-w-5xl gap-x-10 gap-y-10 px-5 py-24 sm:grid-cols-2">
          {FACTS.map((f) => <div key={f.title}><h2 className="text-2xl font-semibold tracking-tight">{f.title}</h2><p className="mt-2 text-muted">{f.body}</p></div>)}
        </section>
      </main>
      <footer className="border-t border-line px-5 pb-20 pt-10 md:pb-10">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4">
          <p className="max-w-xl text-sm text-muted">TagAWallet is not a wallet. It holds no funds and will never ask for your seed phrase, private key or a transaction signature.</p>
          <div className="flex gap-5 text-sm text-muted"><span>© {new Date().getFullYear()} TagAWallet</span><Link href="/privacy" className="hover:underline">Privacy</Link><Link href="/terms" className="hover:underline">Terms</Link></div>
        </div>
      </footer>
    </>
  );
}
