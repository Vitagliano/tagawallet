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
const isLookalike = (a: string) => a !== ALICE && a.slice(0, 6) === ALICE.slice(0, 6) && a.slice(-4) === ALICE.slice(-4);
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const ORANGE = "#EE6A42";
const SHEET = "cubic-bezier(.18,1.1,.3,1)"; // a touch of overshoot, so the wallet has weight

type Msg = { from?: string; text?: string; address?: boolean; mine?: boolean; day?: string; at?: string; wallet?: string };
type Stage = "intro" | "copy" | "open1" | "home1" | "paste" | "typing" | "send1" | "away" | "time" | "open2" | "history" | "confirm" | "reply" | "reveal" | "history3" | "finish" | "everywhere" | "done";

// The group is already mid-conversation when you arrive: people here pay each other.
const START: Msg[] = [
  { from: "You", mine: true, at: "10:28", text: "just bridged over, finally settled" },
  { from: "Tom", at: "10:32", text: "@mira here's mine for the pool", wallet: "0x7Be20C4a91fD36E58b0A1c74D29eF3c6085bA13e" },
  { from: "Mira", at: "10:36", text: "paid, 0.12 ETH. check it arrived?" },
  { from: "Tom", at: "10:37", text: "yep got it, thanks" },
  { from: "Alice", at: "10:41", text: "@you can you send me that 0.1 ETH?" },
];

const TIME: (Msg | { caption: string })[] = [
  { caption: "The next day" }, { day: "Tuesday" },
  { from: "Dev", text: "@tom which wallet for the deposit?" }, { from: "Tom", text: "this one", wallet: "0xD18a6F37c2E05b94A7d1eC8320fB56a9E47c0b2F" }, { from: "Dev", text: "sent 0.5" },
  { from: "You", mine: true, text: "nice, that cleared fast" },
  { caption: "3 days later" }, { day: "Friday" },
  { from: "Mira", text: "anyone watching the market today?" }, { from: "Tom", text: "trying not to" },
  { from: "You", mine: true, text: "same, not opening the app" },
  { from: "Dev", text: "who's minting tonight" }, { from: "Mira", text: "me, maybe" }, { from: "You", mine: true, text: "might sit this one out" },
  { caption: "1 week later" }, { day: "Last Monday" },
  { from: "Mira", text: "@dev is this the grants multisig?", wallet: "0x3dC2f8A61e07B94dD5c2E3a17F60b98C4A2E68aa" }, { from: "Dev", text: "yes, that's the one" },
  { from: "You", mine: true, text: "saved that address, ty" },
  { from: "Tom", text: "gas is low btw" }, { from: "Mira", text: "moving my stuff now then" }, { from: "You", mine: true, text: "good week to consolidate" },
  { caption: "2 weeks later" }, { day: "Today" },
  { from: "You", mine: true, text: "back online, what'd I miss?" },
  { from: "Dev", text: "@mira can you send your share?" }, { from: "Mira", text: "sent, 0.08" }, { from: "Dev", text: "got it" },
  { from: "You", mine: true, text: "share's sorted then" },
];

// Some lookalikes copy the amount of a real payment, so the row itself can't tell you which is hers.
const HISTORY: { addr: string; meta: string }[] = [
  { addr: FAKE_A, meta: "Received 0.001 ETH · 2 hours ago" },
  { addr: "0x91bE35a7C0d2E8f64B1a9D70c3E5f2A6b8D407d3", meta: "Sent 0.25 ETH · yesterday" },
  { addr: FAKE_B, meta: "Sent 0.10 ETH · 6 days ago" },
  { addr: "0xA07c92E1b4F6d3C805aE7b1D69f2C4a83E0Df1e8", meta: "Received 0.40 ETH · 1 week ago" },
  { addr: FAKE_C, meta: "Received 0.001 ETH · 1 week ago" },
  { addr: FAKE_D, meta: "Sent 0.10 ETH · 2 weeks ago" },
  { addr: ALICE, meta: "Sent 0.10 ETH · 2 weeks ago" },
  { addr: "0xfE1460aB7c3D92e18F5d0C6a47B1e93D2Ac8b920", meta: "Received 0.90 ETH · 1 month ago" },
  { addr: "0x5eA184d2C07fB39a6E1dF4c8250B7e96A3d1C74b", meta: "Sent 0.20 ETH · 1 month ago" },
];
// The first time you open the wallet, none of the lookalikes exist yet.
const EARLY = [
  { ...HISTORY[7], meta: "Received 0.90 ETH · 2 weeks ago" },
  { ...HISTORY[8], meta: "Sent 0.20 ETH · 2 weeks ago" },
];

const AVATAR: Record<string, string> = { You: "#5a6472", Alice: ORANGE, Tom: "#2f6f9f", Mira: "#7b5bd6", Dev: "#1b7a4a" };

/** Mentions match the chip on a message that tagged you. On an orange bubble, a soft dark chip keeps the same shape readable. */
function WithMention({ text, onAccent }: { text: string; onAccent?: boolean }) {
  const chip = onAccent
    ? "rounded-sm bg-black/20 px-1 font-medium text-accent-ink"
    : "rounded-sm bg-accent/15 px-1 font-medium text-accent";
  return <>{text.split(/(@\w+)/).map((p, k) => {
    if (p === "@you" || (onAccent && p.startsWith("@"))) return <span key={k} className={chip}>{p}</span>;
    if (p.startsWith("@")) return <span key={k} className="font-medium text-accent">{p}</span>;
    return <span key={k}>{p}</span>;
  })}</>;
}

// Focus without letting the browser scroll to it: the wallet is still off screen when this runs.
const focusQuietly = (el: HTMLElement | null) => { el?.focus({ preventScroll: true }); };

/** A plain Send button that fills while the payment goes out. Stays quiet until it can be used. */
function SendButton({ onSend, onStart, disabled }: { onSend: () => void; onStart: () => void; disabled?: boolean }) {
  const [busy, setBusy] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (!disabled) focusQuietly(buttonRef.current); }, [disabled]);
  const off = disabled || busy;
  return (
    <button ref={buttonRef} type="button" aria-label="Send 0.1 ETH" disabled={off} onClick={() => { setBusy(true); onStart(); window.setTimeout(onSend, reducedMotion() ? 0 : 380); }}
      className={`relative h-14 w-full overflow-hidden rounded-full bg-accent text-lg font-semibold text-accent-ink shadow-lg ${off ? "opacity-40" : "transition-transform duration-200 active:scale-[.97]"} ${disabled || busy ? "" : "pulse-tag hover:scale-[1.02]"}`}>
      {busy && <span aria-hidden className="send-fill absolute inset-y-0 left-0 bg-black/15" style={{ animationDuration: ".38s" }} />}
      <span className="relative">{busy ? "Sending…" : "Send 0.1 ETH"}</span>
    </button>
  );
}

/** One line of wallet history. Tappable only when a payment can start from it. */
function TxRow({ addr, meta, name, onPick, dim, delay, pending }: { addr: string; meta: string; name?: string; onPick?: () => void; dim?: boolean; delay?: string; pending?: boolean }) {
  const [what, when] = meta.split(" · "), out = !what.startsWith("Received"), amount = what.split(" ")[1];
  const body = (
    <>
      {pending
        ? <span aria-hidden className="size-10 shrink-0 animate-spin rounded-full border-[3px] border-line border-t-accent" />
        : <span aria-hidden className={`grid size-10 shrink-0 place-items-center rounded-full ${out ? "bg-wash" : "bg-good/15 text-good"}`}>{out ? "↑" : "↓"}</span>}
      <span className="min-w-0 flex-1">
        {name ? <span className="stamp inline-block rounded-l-full rounded-r-md px-3 py-0.5 text-lg font-semibold text-[#1a0d07]" style={{ background: ORANGE }}>{name}</span> : <span className="block text-lg font-medium leading-tight">{short(addr)}</span>}
        <span className="block text-xs text-muted">{what.split(" ")[0]} {when}</span>
      </span>
      <span className={`shrink-0 font-medium tabular-nums ${out ? "" : "text-good"}`}>{out ? "−" : "+"}{amount}</span>
    </>
  );
  const cls = "flex w-full items-center gap-3 rounded-[1.4rem] px-3 py-2 text-left";
  if (!onPick) return <div className={cls}>{body}</div>;
  return <button type="button" onClick={onPick} aria-label={`${name ? `${name}, ` : ""}${short(addr)}, ${meta}`} className={`${cls} transition-all duration-500 hover:bg-wash active:scale-[.98] ${dim ? "opacity-30" : ""}`} style={{ transitionDelay: delay }}>{body}</button>;
}

/** Shows an address the way people actually check one: the ends stand out. */
function FullAddress({ addr }: { addr: string }) {
  return <p className="break-all text-lg leading-snug"><span className="font-semibold">{addr.slice(0, 6)}</span><span className="text-muted">{addr.slice(6, -4)}</span><span className="font-semibold">{addr.slice(-4)}</span></p>;
}

/** A single-line field with Paste inside it, on the right. It pulses like Tap to copy until the address lands. */
function AddressField({ value, buttonRef, onPaste }: { value: string; buttonRef: React.Ref<HTMLButtonElement>; onPaste: () => void }) {
  return (
    <div className="mt-2 flex h-14 w-full items-center gap-2 rounded-2xl border border-line bg-wash pl-4 pr-1.5">
      <input
        readOnly
        tabIndex={-1}
        aria-label="Recipient address"
        value={value}
        placeholder="Paste the address"
        autoComplete="off"
        onChange={() => {}}
        onPaste={(e) => { e.preventDefault(); onPaste(); }}
        onKeyDown={(e) => { if (e.key !== "Tab") e.preventDefault(); }}
        className="min-w-0 flex-1 bg-transparent text-left text-[15px] text-ink outline-none placeholder:text-muted caret-transparent"
      />
      <button ref={buttonRef} type="button" onClick={onPaste} className={`shrink-0 rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-paper ${value ? "" : "pulse-tag"}`}>Paste</button>
    </div>
  );
}

function Avatar({ name, size = "size-9" }: { name: string; size?: string }) {
  return <span aria-hidden className={`grid shrink-0 place-items-center rounded-full text-sm font-semibold text-white ${size}`} style={{ background: AVATAR[name] ?? "#6a675e" }}>{name[0]}</span>;
}

// The big line says what's happening. The line under it says what to do, and why.
const WORDS: Partial<Record<Stage, [string, string]>> = {
  intro: ["This is your group chat.", "Friends who pay each other in crypto."],
  copy: ["Alice needs 0.1 ETH.", "Copy her address from the chat."],
  open1: ["Her address is copied.", "Open your wallet to pay her."],
  home1: ["This is your wallet.", "Press Send to pay Alice."],
  paste: ["Who are you paying?", "Paste the address you copied."],
  typing: ["Who are you paying?", "Paste the address you copied."],
  send1: ["Check it, then send.", "Press Send to pay her 0.1 ETH."],
  away: ["Paid.", "Back to the group."],
  time: ["Life goes on.", "The group keeps talking."],
  open2: ["She needs 0.1 ETH again.", "Find her address in your wallet."],
  history: ["Which one is Alice?", "Tap the one you think is hers."],
  confirm: ["Is this really Alice?", "Press Send, or go back and check."],
  reply: ["Waiting on Alice…", "Let's see if it arrived."],
  history3: ["Now she has a name.", "Same lookalikes. Tap Alice to pay."],
  finish: ["Waiting on Alice…", "Let's see if it arrived."],
};

// Steps that wait on the visitor: their instruction stands out, and pulses if they stall.
const NEEDS_YOU: Stage[] = ["copy", "open1", "home1", "paste", "send1", "open2", "history", "confirm", "history3"];

/** A small copy of the address travels between two points, so copy and paste feel physical. */
function flyAddress(from: DOMRect, to: DOMRect) {
  if (reducedMotion()) return;
  const pill = document.createElement("span");
  pill.textContent = short(ALICE);
  pill.setAttribute("aria-hidden", "true");
  pill.style.cssText = `position:fixed;left:0;top:0;z-index:60;padding:6px 14px;border-radius:999px;background:${ORANGE};color:#1a0d07;font:600 14px var(--font-instrument),sans-serif;pointer-events:none;white-space:nowrap`;
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
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [stage, setStage] = useState<Stage>("intro");
  const [caption, setCaption] = useState("");
  const [typing, setTyping] = useState("");
  const [typed, setTyped] = useState("");
  const [sent, setSent] = useState(false);
  const [settled, setSettled] = useState(false);
  const [locked, setLocked] = useState(false); // a payment is going out, so Back does nothing
  const [slide, setSlide] = useState(false); // moving between wallet screens, not arriving from the chat
  const [balance, setBalance] = useState(1.2);
  const [picked, setPicked] = useState<string | null>(null);
  const [wrong, setWrong] = useState<string | null>(null);
  const [name, setName] = useState("Alice");
  const [named, setNamed] = useState("");
  const [nudge, setNudge] = useState<string | null>(null);
  const [fadeMiddle, setFadeMiddle] = useState(false);
  const [landed, setLanded] = useState(0);
  const [idle, setIdle] = useState(false);
  const shownBalance = useCounted(balance);
  const walletButton = useRef<HTMLButtonElement>(null);
  const pasteButton = useRef<HTMLButtonElement>(null);
  const pasteRef = useRef<() => void>(() => {});
  const inner = useRef<HTMLDivElement>(null);
  const lastH = useRef(0);
  const timers = useRef<number[]>([]);
  const openingWallet = useRef(false);
  const href = signedIn ? "/dashboard" : "/signup";

  const after = useCallback((ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, reducedMotion() ? Math.min(ms, 40) : ms));
  }, []);
  const say = useCallback((m: Msg) => setMsgs((l) => [...l, m]), []);

  const begin = useCallback(() => {
    timers.current.forEach(clearTimeout); timers.current = [];
    lastH.current = 0;
    openingWallet.current = false;
    setMsgs([]);
    setStage("intro"); setTyping(""); setCaption(""); setTyped(""); setSent(false); setSettled(false); setLocked(false); setSlide(false); setBalance(1.2); setPicked(null); setWrong(null); setName("Alice"); setNamed(""); setNudge(null); setFadeMiddle(false); setLanded(0);
    // The conversation plays out, and stops on the message that needs you.
    let t = 350;
    for (const m of START) {
      if (m.mine) {
        after(t, () => say(m));
        t += 420;
        continue;
      }
      after(t, () => setTyping(m.from ?? ""));
      t += 600;
      after(t, () => { setTyping(""); say(m); });
      t += 220;
    }
    after(t + 300, () => { say({ from: "Alice", at: "10:41", address: true }); setStage("copy"); });
  }, [after, say]);

  useEffect(() => { begin(); return () => timers.current.forEach(clearTimeout); }, [begin]);

  // Keep the page still while the hero story is running; unlock once the final CTA lands.
  useEffect(() => {
    if (stage === "done") return;
    const html = document.documentElement, body = document.body;
    const prevHtml = html.style.overflow, prevBody = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => { html.style.overflow = prevHtml; body.style.overflow = prevBody; };
  }, [stage]);

  // New messages push the old ones up smoothly. Additive, so quick bursts stack into one glide.
  useLayoutEffect(() => {
    const el = inner.current;
    if (!el) return;
    const h = el.offsetHeight, d = h - lastH.current;
    lastH.current = h;
    if (d > 0 && d < 400 && d !== h && !reducedMotion()) el.animate([{ transform: `translateY(${d}px)` }, { transform: "translateY(0)" }], { duration: 480, easing: "cubic-bezier(.2,.8,.2,1)", composite: "add" });
  }, [msgs, typing]);

  useEffect(() => {
    setIdle(false);
    if (!NEEDS_YOU.includes(stage)) return;
    const id = window.setTimeout(() => setIdle(true), 6000);
    return () => clearTimeout(id);
  }, [stage]);

  // These moments must land on screen, even if the visitor has scrolled the page meanwhile.
  useEffect(() => {
    if (stage === "open2" || stage === "reveal" || stage === "done") scrollTo({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" });
  }, [stage]);

  useEffect(() => {
    if (stage === "open1" || stage === "open2") { setSlide(false); focusQuietly(walletButton.current); }
  }, [stage]);

  const passTime = () => {
    setStage("time");
    let t = 300, n = 0;
    for (const item of TIME) {
      if ("caption" in item) { t += 300; const c = item.caption; after(t, () => setCaption(c)); t += 180; continue; }
      // Starts unhurried, then the days blur.
      t += Math.max(90, 220 - n * 10); n++;
      after(t, () => say(item));
    }
    t += 700;
    after(t - 600, () => setTyping("Alice"));
    after(t, () => { setTyping(""); say({ from: "Alice", at: "14:08", text: "@you can you send me another 0.1 ETH? same address as before." }); });
    after(t + 800, () => { setCaption(""); setStage("open2"); });
  };

  const copyAddress = () => {
    if (stage !== "copy") return;
    navigator.clipboard?.writeText(ALICE).catch(() => {});
    const from = document.querySelector('[aria-label="Copy Alice\'s address"]')!.getBoundingClientRect();
    setStage("open1");
    after(40, () => { if (walletButton.current) flyAddress(from, walletButton.current.getBoundingClientRect()); });
  };

  const paste = () => {
    if (locked || stage !== "paste") return;
    setTyped(ALICE);
    setStage("send1");
  };
  pasteRef.current = paste;

  // The Paste button is the action. Ctrl/Cmd+V drops in the same copied address.
  useEffect(() => {
    if (stage !== "paste") return;
    focusQuietly(pasteButton.current);
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.key.toLowerCase() !== "v") return;
      e.preventDefault();
      pasteRef.current();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [stage]);

  // After Send you land back on Home: the payment appears in your activity, then confirms.
  const confirmPayment = (fn: () => void) => {
    setSent(true); setSettled(false); setLocked(false);
    after(750, () => { setSettled(true); fn(); });
  };

  const sendFirst = () => {
    confirmPayment(() => setBalance(1.1));
    after(1650, () => { setStage("away"); setSent(false); setTyped(""); });
    after(2000, () => say({ from: "You", mine: true, at: "now", text: "@alice sent!" }));
    after(2600, () => say({ from: "Alice", text: "got it, thanks!" }));
    after(3000, () => say({ from: "You", mine: true, text: "anytime" }));
    after(3600, passTime);
  };

  const sendPayment = (to: string, third: boolean) => {
    const ok = to === ALICE;
    confirmPayment(() => setBalance((b) => b - 0.1));
    after(1650, () => { setStage(third ? "finish" : "reply"); setSent(false); });
    if (!ok) setWrong(to);
    after(2000, () => say({ from: "You", mine: true, at: "now", text: ok ? "@alice sent!" : "sent!" }));
    after(2800, () => say({
      from: "Alice",
      text: third
        ? "perfect, we're square. thank you!"
        : ok
          ? "got it! lucky, half your history looks like me now."
          : isLookalike(to)
            ? "hmm, nothing arrived. which address did you use?"
            : "that's not even my wallet. did you copy a random one?",
    }));
    after(4100, () => {
      setPicked(null);
      if (!third) { setStage("reveal"); return; }
      setStage("everywhere");
      // The name lands on each surface in turn, then the page says what the product is.
      [150, 750, 1350].forEach((ms, k) => timers.current.push(window.setTimeout(() => setLanded(k + 1), ms)));
      timers.current.push(window.setTimeout(() => setStage("done"), 3800));
    });
    if (!third) after(5100, () => setFadeMiddle(true));
  };

  const pick = (a: string) => {
    const flyFrom = (document.querySelector(`[data-row="${a}"]`) as HTMLElement | null)?.getBoundingClientRect();
    if (stage === "history" || stage === "confirm") {
      setPicked(a); setStage("confirm");
      after(60, () => { const t = document.querySelector("[data-to]")?.getBoundingClientRect(); if (flyFrom && t) flyAddress(flyFrom, t); });
    }
    if (stage === "history3") {
      if (a !== ALICE) { setNudge(a); after(600, () => setNudge(null)); return; }
      // Her name is all the checking you need, so one tap pays her.
      setPicked(a); sendPayment(a, true);
    }
  };

  const saveName = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = name.trim() || "Alice";
    setStage("history3");
    // The wallet rises first, then the name lands and everything else recedes.
    after(650, () => setNamed(clean));
  };

  const sheetUp = ["home1", "paste", "typing", "send1", "history", "confirm", "history3"].includes(stage);
  const showHistory = stage === "history" || stage === "history3";
  const confirming = stage === "confirm";
  const firstRound = stage === "home1" || stage === "send1" || stage === "away";
  const paidTo = firstRound ? ALICE : picked ?? ALICE;
  const closing = stage === "away" || stage === "reply" || stage === "finish"; // keep Home on screen while it slides away
  const showPaid = sent || closing;
  const pickedRow = HISTORY.find((r) => r.addr === picked);
  const back = () => { setPicked(null); setStage("history"); };
  const done = stage === "done", reveal = stage === "reveal";
  const trapped = !!wrong && isLookalike(wrong);
  const unlike = !!wrong && !trapped;
  const compared = wrong || FAKE_D;
  const comparedLabel = wrong ? "You paid" : "A lookalike in your history";
  const [line, todo] = WORDS[stage] ?? ["", ""];
  const words = sent ? (settled ? "Sent." : "Sending…") : caption || line;
  const instruction = sent ? "" : todo;

  return (
    <section className="relative flex h-dvh min-h-[640px] flex-col overflow-clip">
      <header className="relative z-30 flex shrink-0 items-center justify-between px-5 py-4">
        <span className="flex flex-col sm:flex-row sm:items-center sm:gap-4"><Logo className="text-lg" /><span className="text-xs text-muted sm:text-sm">Name any wallet, privately.</span></span>
        <Link href={href} className="text-sm font-medium hover:underline">{signedIn ? "Dashboard" : "Get started"}</Link>
      </header>

      {!done && !reveal && stage !== "everywhere" && (
        <div className="relative z-0 flex h-[clamp(7rem,17vh,9.5rem)] shrink-0 flex-col items-center justify-center px-5 text-center">
          <p key={words} aria-live="polite" className="caption-in whitespace-nowrap text-[clamp(1.6rem,5vw,4rem)] font-semibold leading-[1.02] tracking-[-0.02em]">{words}</p>
          <p key={instruction} aria-live="polite" className={`caption-in mt-2 h-7 whitespace-nowrap text-lg leading-7 md:text-xl ${instruction && NEEDS_YOU.includes(stage) ? "font-semibold text-accent" : "text-muted"} ${idle ? "motion-safe:animate-pulse" : ""}`} style={{ animationDelay: "120ms" }}>{instruction}</p>
        </div>
      )}

      {/* The chat is the world. It sits back when the wallet rises over it. */}
      <div className={`relative mx-auto min-h-0 w-full max-w-xl flex-1 overflow-clip px-4 transition-opacity duration-500 motion-reduce:transition-none ${done || reveal || stage === "everywhere" ? "opacity-0" : ""}`}>
        {/* No frame: the conversation sits straight on the page. */}
        <div className="absolute inset-x-3 bottom-0 top-0 flex flex-col transition-all duration-700" style={{ transitionTimingFunction: SHEET, transformOrigin: "50% 100%", transform: sheetUp ? "scale(.96)" : "none", opacity: sheetUp ? 0.35 : 1 }}>
          <div className="flex shrink-0 items-center justify-center gap-3 pb-2">
            <span className="flex -space-x-2" aria-hidden>{["Alice", "Tom", "Mira", "Dev"].map((n) => <span key={n} className="rounded-full ring-2 ring-paper"><Avatar name={n} size="size-8" /></span>)}</span>
            <span className="text-left"><span className="block text-lg font-semibold leading-tight">the frens</span><span className="block text-xs text-muted">Alice, Tom, Mira, Dev and you</span></span>
          </div>
          {/* Runs to the bottom of the screen, so arriving messages are never cut as they slide up. */}
          <div data-chat-clip className="flex min-h-0 flex-1 flex-col justify-end overflow-hidden pb-[8.5rem]" style={{ maskImage: "linear-gradient(transparent, #000 48px)" }}>
            <div ref={inner} className="space-y-1">
              {msgs.map((m, k) => {
                if (m.day) return <p key={k} className="bubble-in py-3 text-center text-sm font-medium text-muted">{m.day}</p>;
                if (m.mine) {
                  const prev = msgs[k - 1], grouped = prev?.mine && !prev?.day;
                  return (
                    <div key={k} className={`bubble-in origin-bottom-right ml-auto flex max-w-[calc(100%-0.5rem)] items-end justify-end gap-2 ${grouped ? "" : "mt-2"}`}>
                      <p className="w-fit rounded-[1.4rem] rounded-br-md bg-accent px-4 py-2.5 text-lg text-accent-ink"><WithMention text={m.text ?? ""} onAccent />{m.at && <span className="ml-2 text-[11px] opacity-70">{m.at}</span>}</p>
                      {grouped ? <span className="w-9 shrink-0" aria-hidden /> : <Avatar name="You" />}
                    </div>
                  );
                }
                const prev = msgs[k - 1], grouped = prev?.from === m.from && !prev?.day, mention = !!m.text?.includes("@you");
                return (
                  <div key={k} className={`bubble-in origin-bottom-left flex items-end gap-2 ${grouped ? "" : "pt-2"}`}>
                    {grouped ? <span className="w-9 shrink-0" aria-hidden /> : <Avatar name={m.from ?? ""} />}
                    <div className="min-w-0">
                      {!grouped && <p className="mb-0.5 pl-4 text-sm font-semibold leading-tight" style={{ color: AVATAR[m.from ?? ""] }}>{m.from}{m.at && <span className="ml-2 text-[11px] font-normal text-muted">{m.at}</span>}</p>}
                      {m.address ? (
                        <button type="button" onClick={copyAddress} aria-label="Copy Alice's address" className={`w-fit rounded-[1.4rem] rounded-bl-md px-4 py-2.5 text-left text-lg leading-snug ${mention ? "bg-accent/10" : "bg-wash"} ${stage === "copy" ? "pulse-tag" : ""}`}>
                          <span className="block break-all text-[15px] font-medium leading-snug md:text-base">{ALICE}</span>
                          <span className="mt-1 block text-sm font-semibold text-accent">{stage === "copy" ? "Tap to copy" : "Copied ✓"}</span>
                        </button>
                      ) : (
                        <div className={`w-fit rounded-[1.4rem] rounded-bl-md px-4 py-2.5 text-lg leading-snug ${mention ? "bg-accent/10" : "bg-wash"}`}>
                          <WithMention text={m.text ?? ""} />{m.wallet && <span className="mt-1 block break-all text-[15px] leading-snug md:text-base">{m.wallet}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {typing && (
                <div className="bubble-in origin-bottom-left flex items-end gap-2 pt-2" aria-label={`${typing} is typing`}>
                  <Avatar name={typing} />
                  <div className="flex h-11 items-center gap-1 rounded-[1.4rem] rounded-bl-md bg-wash px-4">{[0, 1, 2].map((d) => <span key={d} className="typing-dot size-1.5 rounded-full bg-current" style={{ animationDelay: `${d * 130}ms` }} />)}</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stays put while the wallet rises over it, rather than vanishing on press. */}
        {(stage === "open1" || stage === "open2" || (sheetUp && (stage === "paste" || stage === "history"))) && (
          <div className="pop absolute inset-x-0 bottom-[4.5rem] z-10 flex justify-center">
            <button ref={walletButton} type="button" tabIndex={sheetUp ? -1 : 0} onClick={() => {
              if (sheetUp) return;
              if (stage === "open1") {
                if (openingWallet.current) return;
                openingWallet.current = true;
                // Land the reply in chat first, then open the wallet over it.
                say({ from: "You", mine: true, at: "now", text: "sure, sending now" });
                after(900, () => setStage("paste"));
                after(1100, () => setTyping("Tom"));
                after(1700, () => { setTyping(""); say({ from: "Tom", text: "nice, i'll get the next one" }); });
                return;
              }
              setStage("history");
            }} className={`rounded-full bg-ink px-7 py-3.5 text-lg font-semibold text-paper transition-transform duration-200 hover:scale-105 active:scale-95 ${sheetUp ? "" : "pulse-tag"}`}>Open your wallet</button>
          </div>
        )}

        {/* The wallet rises from the bottom edge of the screen. */}
        <div aria-hidden={!sheetUp} className={`absolute inset-x-2 -bottom-6 top-0 z-20 flex flex-col overflow-hidden rounded-t-[2rem] border border-b-0 border-line bg-card shadow-[0_-30px_80px_-20px_rgba(0,0,0,.35)] transition-transform duration-700 ${sheetUp ? "" : "pointer-events-none invisible"}`} style={{ transform: sheetUp ? "translateY(0)" : "translateY(106%)", transitionTimingFunction: SHEET, visibility: sheetUp || stage === "away" || stage === "reply" || stage === "time" || stage === "finish" ? "visible" : undefined }}>
          <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-line" aria-hidden />
          {showPaid || stage === "home1" || showHistory ? (
            /* Home: what you have, and what's happened. */
            <div key={firstRound ? "home1" : "home2"} className={`${sent || slide ? "screen-in" : "sheet-content"} min-h-0 flex-1 overflow-y-auto px-3 pb-28 pt-3`}>
              <div className="text-center">
                <p className="flex items-center justify-center gap-2 text-sm font-medium text-muted"><span aria-hidden className="size-4 rounded-full" style={{ background: "conic-gradient(#EE6A42, #E9B44C, #1b7a4a, #2f6f9f, #EE6A42)" }} />Main wallet · Ethereum</p>
                <p className="mt-2 text-[clamp(3rem,10vw,4.5rem)] font-semibold leading-none tabular-nums tracking-[-0.02em]">{shownBalance.toFixed(2)} <span className="text-muted">ETH</span></p>
                {stage === "home1" && !sent && <button ref={focusQuietly} type="button" onClick={() => { setSlide(true); setStage("paste"); }} className="pulse-tag mt-5 rounded-full bg-accent px-10 py-3.5 text-lg font-semibold text-accent-ink transition-transform duration-200 hover:scale-105 active:scale-95">Send</button>}
              </div>
              <ul className="mt-4">
                {showPaid && (
                  <li key="pending" className="pop">
                    <p className="pb-1 pt-3 text-center text-sm font-medium text-muted">Just now</p>
                    <div className={`rounded-[1.4rem] transition-colors duration-500 ${settled ? "bg-good/10" : "bg-accent/10"}`}>
                      <TxRow addr={paidTo} meta={settled ? "Sent 0.10 ETH · just now" : "Sending 0.10 ETH · now"} name={named && paidTo === ALICE ? named : undefined} pending={!settled} />
                    </div>
                  </li>
                )}
                {(firstRound ? EARLY : HISTORY).map((r, k) => {
                  const her = !!named && r.addr === ALICE;
                  const label = firstRound ? (k === 0 ? "Recent" : "") : k === 0 ? "Today" : k === 1 ? "This week" : k === 5 ? "Earlier" : "";
                  return (
                    <li key={r.addr} data-row={r.addr} className={`${firstRound || showPaid ? "" : "rise"} ${nudge === r.addr ? "shake" : ""}`} style={{ "--d": `${named ? 0 : k * 70 + 200}ms` } as React.CSSProperties}>
                      {label && <p className="pb-1 pt-3 text-center text-sm font-medium text-muted">{label}</p>}
                      <TxRow addr={r.addr} meta={r.meta} name={her ? named : undefined} onPick={firstRound || showPaid ? undefined : () => pick(r.addr)} dim={!!named && !her} delay={named && !her ? `${k * 35}ms` : "0ms"} />
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            /* Send: a screen that pushes in from the side, then one clear button. */
            <div key="send" className={`${slide ? "screen-in" : "sheet-content"} flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pb-44 pt-3`}>
              <div className="flex items-center justify-between text-sm">
                <button type="button" onClick={() => { if (locked || stage === "typing") return; setSlide(true); if (stage === "paste") setStage("home1"); else if (stage === "send1") { setTyped(""); setStage("paste"); } else back(); }} className="font-medium text-muted hover:text-ink">← Back</button>
                <span className="tabular-nums text-muted">{shownBalance.toFixed(2)} ETH available</span>
              </div>
              <p className="mt-[3vh] text-center text-sm font-medium text-muted">You&apos;re sending</p>
              <p className="text-center text-[clamp(3.25rem,11vw,5rem)] font-semibold leading-none tracking-[-0.01em]">0.1 <span className="text-muted">ETH</span></p>
              <p className="mt-6 text-center text-sm font-medium text-muted">to</p>
              <div data-to className="mt-1 text-center">
                {confirming ? (
                  <div key={picked} className="pop">
                    {!!named && picked === ALICE && <span className="stamp mb-2 inline-block rounded-l-full rounded-r-xl px-4 py-1 text-2xl font-semibold text-[#1a0d07]" style={{ background: ORANGE }}>{named}</span>}
                    {picked && <FullAddress addr={picked} />}
                    {pickedRow && <p className="mt-2 text-sm text-muted">{pickedRow.meta.replace(" · ", ", ")}</p>}
                  </div>
                ) : (
                  <AddressField value={typed} buttonRef={pasteButton} onPaste={paste} />
                )}
              </div>
              <p className="mt-6 text-center text-xs text-muted">Network fee ~0.0004 ETH · about 15 seconds</p>
            </div>
          )}

          {(stage === "paste" || stage === "typing" || stage === "send1" || stage === "confirm") && !sent && (
            <div className="absolute inset-x-4 bottom-[6rem] z-10">
              <SendButton disabled={stage !== "send1" && stage !== "confirm"} onStart={() => setLocked(true)} onSend={stage === "send1" ? sendFirst : () => sendPayment(picked ?? "", false)} />
            </div>
          )}
        </div>
      </div>

      {/* Same start, same end: the middles fall away and leave what you actually compared. */}
      {reveal && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center px-5 pb-16 pt-16 text-center">
          <h2 className="pop text-[clamp(2.5rem,7vw,5.5rem)] font-semibold leading-none tracking-[-0.04em]">{wrong ? "That wasn't Alice." : "You found her. This time."}</h2>
          <div className="pop mt-8 space-y-3 text-center font-medium text-[clamp(12.5px,3.5vw,24px)]" style={{ animationDelay: "250ms" }}>
            {[compared, ALICE].map((a, k) => (
              <p key={k} className="whitespace-nowrap">
                <span className="mb-0.5 block text-sm font-medium text-muted">{k ? "Alice" : comparedLabel}</span>
                {unlike
                  ? <span className="break-all text-lg leading-snug"><span className="font-semibold">{a.slice(0, 6)}</span><span className="text-muted">{a.slice(6, -4)}</span><span className="font-semibold">{a.slice(-4)}</span></span>
                  : <>
                    <span className={`rounded-sm font-bold text-accent transition-colors duration-700 ${fadeMiddle ? "bg-accent/15" : ""}`}>{a.slice(0, 6)}</span>
                    <span className="transition-opacity duration-1000" style={{ opacity: fadeMiddle ? 0.14 : 1 }}>{a.slice(6, -4)}</span>
                    <span className={`rounded-sm font-bold text-accent transition-colors duration-700 ${fadeMiddle ? "bg-accent/15" : ""}`}>{a.slice(-4)}</span>
                  </>}
              </p>
            ))}
          </div>
          <p className={`mt-6 max-w-md text-lg text-muted transition-opacity duration-700 ${fadeMiddle ? "opacity-100" : "opacity-0"}`}>{
            trapped
              ? "That 0.1 ETH is gone. Same start, same end. That transfer was put in your history on purpose."
              : unlike
                ? "That 0.1 ETH is gone. That wallet looked nothing like hers. The dangerous ones share a start and an end."
                : "Same start, same end. Transfers like that one are put in your history on purpose."
          }</p>
          <form onSubmit={saveName} className={`mt-6 w-full max-w-sm rounded-3xl border border-line bg-card p-4 text-left shadow-2xl transition-all duration-700 ${fadeMiddle ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"}`}>
            <p className="flex items-center gap-2 font-semibold"><BrandMark size={26} />TagAWallet</p>
            <p className="mt-1 text-sm text-muted">Give this address a name only you can see.</p>
            <div className="mt-3 flex items-center gap-2 rounded-l-full rounded-r-2xl py-1.5 pl-5 pr-1.5" style={{ background: ORANGE }}>
              <input aria-label="Name this wallet" value={name} maxLength={20} autoComplete="off" onChange={(e) => setName(e.target.value)} className="min-w-0 flex-1 bg-transparent text-xl font-semibold text-[#1a0d07] outline-none" style={{ outline: "none" }} tabIndex={fadeMiddle ? 0 : -1} />
              <button tabIndex={fadeMiddle ? 0 : -1} className="shrink-0 rounded-xl bg-[#1a0d07] px-4 py-2.5 font-semibold text-white active:scale-95">Tag her wallet</button>
            </div>
          </form>
        </div>
      )}

      {/* The payoff: one name, on every surface she appears. */}
      {stage === "everywhere" && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center px-5 pb-16 pt-16">
          <h2 className="caption-in text-center text-[clamp(2.25rem,6vw,4.75rem)] font-semibold leading-none tracking-[-0.03em]">{named}, everywhere.</h2>
          <p className="caption-in mt-3 text-center text-lg text-muted md:text-xl" style={{ animationDelay: "120ms" }}>Tag once. See it wherever you look.</p>
          <ul className="mt-8 w-full max-w-xl space-y-3">
            {[
              { where: "In your group chat", before: "Same address as before: ", after: "" },
              { where: "On the explorer", before: "From ", after: " · 0.10 ETH" },
              { where: "On X", before: "Funds went straight to ", after: "" },
            ].map((r, k) => (
              <li key={r.where} className="rise" style={{ "--d": `${k * 600}ms` } as React.CSSProperties}>
                <p className="mb-1 pl-4 text-sm font-medium text-muted">{r.where}</p>
                <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 rounded-[1.4rem] bg-wash px-4 py-2.5 text-lg leading-snug">
                  <span>{r.before}</span>
                  {landed > k
                    ? <span className="stamp inline-flex items-center gap-1.5 rounded-l-full rounded-r-md px-2.5 py-0.5 font-semibold text-[#1a0d07]" style={{ background: ORANGE }}>{named}</span>
                    : <span className="font-medium">{short(ALICE)}</span>}
                  {r.after && <span>{r.after}</span>}
                </p>
              </li>
            ))}
          </ul>
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

export function Lookalike6Landing({ signedIn }: { signedIn: boolean }) {
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
          <div className="flex gap-5 text-sm text-muted"><span>© {new Date().getFullYear()} TagAWallet</span><Link href="/privacy" className="hover:underline">Privacy</Link><Link href="/terms" className="hover:underline">Terms</Link></div>
        </div>
      </footer>
    </>
  );
}
