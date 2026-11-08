"use client";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { BrandMark } from "@/components/brand-mark";
import { Logo } from "@/components/ui";

/* A board instead of a page. You pan around it and tie the evidence together. */

const BOARD = { w: 2200, h: 1500 };
const SUBJECT = "subject";

type Item = { id: string; x: number; y: number; rot: number; kind: "subject" | "wallet" | "social" | "decoy"; title: string; detail: string; note: string };

const ITEMS: Item[] = [
  { id: SUBJECT, x: 1010, y: 660, rot: -1, kind: "subject", title: "0x4c1f…2c15", detail: "Unknown. Moved 88 ETH on Tuesday.", note: "" },
  { id: "base", x: 520, y: 570, rot: -4, kind: "wallet", title: "0x8Ba1…BA72", detail: "On Base. Funded by the subject the same day.", note: "Same owner: this wallet was funded by the subject." },
  { id: "sol", x: 1500, y: 480, rot: 3, kind: "wallet", title: "7xKX…gAsU", detail: "On Solana. Linked in the subject's ENS profile.", note: "Same owner: the ENS profile lists it." },
  { id: "ens", x: 500, y: 860, rot: 2, kind: "social", title: "alice-otc.eth", detail: "ENS name that resolves to the subject.", note: "That's a name. The address resolves to it." },
  { id: "x", x: 1510, y: 830, rot: -3, kind: "social", title: "@alice_otc", detail: "Post: “my desk settles from 0x4c1f…2c15”", note: "A public post claims this address." },
  { id: "decoy", x: 1010, y: 960, rot: 2, kind: "decoy", title: "0xb71a…40ce", detail: "Exchange deposit wallet. The subject sent funds here.", note: "Thousands of people use this one. It proves nothing." },
];
const LINKS_NEEDED = ITEMS.filter((i) => i.kind === "wallet" || i.kind === "social").length;

const NOTES = [
  { x: 150, y: 170, rot: -3, title: "Private by default", body: "Nobody sees this board but you, until you invite someone." },
  { x: 1810, y: 200, rot: 3, title: "Every label shows its source", body: "Your private tag, a shared list, a self-claim or a verified profile." },
  { x: 130, y: 1130, rot: 2, title: "Where you already work", body: "Your names appear on explorers, X and trading tools you enable. Page content never leaves your browser." },
  { x: 1800, y: 1110, rot: -2, title: "Not a wallet", body: "It holds no funds and will never ask for your seed phrase, private key or a transaction signature." },
];

function stringPath(a: { x: number; y: number }, b: { x: number; y: number }) {
  // Yarn sags in the middle, more over a longer run.
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 + Math.min(70, Math.hypot(a.x - b.x, a.y - b.y) * 0.14);
  return `M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`;
}

export function CaseLanding({ signedIn }: { signedIn: boolean }) {
  const viewport = useRef<HTMLDivElement>(null);
  const board = useRef<HTMLDivElement>(null);
  const view = useRef({ x: 0, y: 0, s: 1 });
  const pan = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  const [pos, setPos] = useState<Record<string, { x: number; y: number }>>(() => Object.fromEntries(ITEMS.map((i) => [i.id, { x: i.x, y: i.y }])));
  const [links, setLinks] = useState<string[]>([]);
  const [pull, setPull] = useState<{ from: string; x: number; y: number } | null>(null);
  const [armed, setArmed] = useState<string | null>(null);
  const [message, setMessage] = useState("Drag from a pin to the unknown wallet. Tie what belongs together.");
  const [wrong, setWrong] = useState<string | null>(null);
  const [closed, setClosed] = useState(false);
  const moved = useRef<{ id: string; dx: number; dy: number } | null>(null);

  const apply = () => { if (board.current) board.current.style.transform = `translate(${view.current.x}px, ${view.current.y}px) scale(${view.current.s})`; };
  const clampView = () => {
    const v = viewport.current!, c = view.current;
    c.x = Math.min(120, Math.max(v.clientWidth - BOARD.w * c.s - 120, c.x));
    c.y = Math.min(120, Math.max(v.clientHeight - BOARD.h * c.s - 120, c.y));
  };
  const center = (x: number, y: number) => {
    const v = viewport.current!, c = view.current;
    c.x = v.clientWidth / 2 - x * c.s; c.y = v.clientHeight / 2 - y * c.s; clampView(); apply();
  };

  useLayoutEffect(() => {
    const fit = () => {
      const v = viewport.current!;
      // Phones get readable cards and pan to the rest, rather than a tiny overview.
      view.current.s = v.clientWidth < 700 ? 0.8 : Math.max(0.6, Math.min(1, Math.min(v.clientWidth / 1300, v.clientHeight / 880)));
      center(1010, v.clientWidth < 700 ? 560 : 650);
    };
    fit();
    addEventListener("resize", fit);
    return () => removeEventListener("resize", fit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // The wheel moves the board; there is no page to scroll.
    const el = viewport.current!;
    const on = (e: WheelEvent) => { e.preventDefault(); view.current.x -= e.deltaX; view.current.y -= e.deltaY; clampView(); apply(); };
    el.addEventListener("wheel", on, { passive: false });
    return () => el.removeEventListener("wheel", on);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toBoard = (e: React.PointerEvent | PointerEvent) => {
    const r = viewport.current!.getBoundingClientRect(), c = view.current;
    return { x: (e.clientX - r.left - c.x) / c.s, y: (e.clientY - r.top - c.y) / c.s };
  };

  const tie = (a: string, b: string) => {
    const other = a === SUBJECT ? b : b === SUBJECT ? a : null;
    if (!other) { setMessage("Everything has to tie back to the unknown wallet."); return; }
    const item = ITEMS.find((i) => i.id === other)!;
    if (links.includes(other)) return;
    setMessage(item.note);
    if (item.kind === "decoy") { setWrong(other); setTimeout(() => setWrong(null), 700); return; }
    const next = [...links, other];
    setLinks(next);
    if (next.length === LINKS_NEEDED) { setMessage("That's everything. Case closed."); setTimeout(() => setClosed(true), 650); }
  };

  const tryPin = (id: string) => {
    if (armed && armed !== id) { tie(armed, id); setArmed(null); }
    else setArmed(armed === id ? null : id);
  };

  const status = closed ? "Solved" : `${links.length} of ${LINKS_NEEDED} clues tied`;

  return (
    <div className="fixed inset-0 overflow-hidden bg-wash text-ink">
      <main ref={viewport} className="absolute inset-0 cursor-grab touch-none select-none active:cursor-grabbing"
        style={{ backgroundImage: "radial-gradient(color-mix(in srgb, var(--muted) 35%, transparent) 1px, transparent 1px)", backgroundSize: "26px 26px" }}
        onPointerDown={(e) => { if (e.target === e.currentTarget || e.target === board.current) { e.currentTarget.setPointerCapture(e.pointerId); pan.current = { px: e.clientX, py: e.clientY, x: view.current.x, y: view.current.y }; } }}
        onPointerMove={(e) => {
          if (pan.current) { view.current.x = pan.current.x + e.clientX - pan.current.px; view.current.y = pan.current.y + e.clientY - pan.current.py; clampView(); apply(); }
          if (moved.current) { const p = toBoard(e), m = moved.current; setPos((o) => ({ ...o, [m.id]: { x: p.x - m.dx, y: p.y - m.dy } })); }
          if (pull) { const p = toBoard(e); setPull({ ...pull, ...p }); }
        }}
        onPointerUp={(e) => {
          pan.current = null; moved.current = null;
          if (pull) {
            const hit = document.elementsFromPoint(e.clientX, e.clientY).map((el) => (el as HTMLElement).closest?.("[data-card]") as HTMLElement | null).find(Boolean);
            if (hit && hit.dataset.card !== pull.from) tie(pull.from, hit.dataset.card!);
            setPull(null);
          }
        }}>
        <div ref={board} className="absolute left-0 top-0 origin-top-left" style={{ width: BOARD.w, height: BOARD.h }}>
          <svg aria-hidden className="pointer-events-none absolute inset-0 z-20 overflow-visible" width={BOARD.w} height={BOARD.h}>
            {links.map((id) => <path key={id} d={stringPath(pos[SUBJECT], pos[id])} fill="none" stroke="#EE6A42" strokeWidth="4" strokeLinecap="round" />)}
            {pull && <path d={stringPath(pos[pull.from], pull)} fill="none" stroke="#EE6A42" strokeWidth="4" strokeLinecap="round" strokeDasharray="1 9" />}
            {wrong && <path d={stringPath(pos[SUBJECT], pos[wrong])} fill="none" stroke="var(--bad)" strokeWidth="4" strokeLinecap="round" strokeDasharray="10 8" />}
          </svg>

          {NOTES.map((n) => (
            <article key={n.title} className="absolute w-72 bg-[#E9B44C] p-5 text-[#1a1a18] shadow-[0_18px_30px_-16px_rgba(0,0,0,.45)]" style={{ left: n.x, top: n.y, rotate: `${n.rot}deg` }}>
              <h2 className="text-xl font-semibold leading-tight tracking-tight">{n.title}</h2>
              <p className="mt-2 text-sm leading-relaxed">{n.body}</p>
            </article>
          ))}

          {ITEMS.map((it) => {
            const p = pos[it.id], tied = links.includes(it.id), subject = it.kind === "subject";
            return (
              <article key={it.id} data-card={it.id}
                onPointerDown={(e) => { if ((e.target as HTMLElement).closest("button")) return; e.currentTarget.parentElement!.parentElement!.setPointerCapture(e.pointerId); const b = toBoard(e); moved.current = { id: it.id, dx: b.x - p.x, dy: b.y - p.y }; }}
                className={`absolute z-10 w-60 -translate-x-1/2 -translate-y-1/2 cursor-move rounded-sm p-4 pt-6 shadow-[0_18px_30px_-16px_rgba(0,0,0,.5)] ${wrong === it.id ? "shake" : ""} ${subject ? "w-72 bg-ink text-paper" : "border border-line bg-card"}`}
                style={{ left: p.x, top: p.y, rotate: `${it.rot}deg` }}>
                <button type="button" aria-label={`String from ${it.title}`} aria-pressed={armed === it.id}
                  onPointerDown={(e) => { e.stopPropagation(); e.currentTarget.closest("main")!.setPointerCapture(e.pointerId); setPull({ from: it.id, x: p.x, y: p.y }); }}
                  onClick={() => tryPin(it.id)}
                  className={`absolute left-1/2 top-0 z-30 size-7 -translate-x-1/2 -translate-y-1/2 cursor-crosshair rounded-full border-[3px] border-white/70 shadow-md transition-transform duration-150 hover:scale-125 ${tied || subject ? "bg-[#EE6A42]" : armed === it.id ? "scale-125 bg-[#EE6A42]" : "bg-[#c8421b]"} ${armed === it.id ? "ring-4 ring-[#EE6A42]/40" : ""}`} />
                <p className={`font-mono font-medium ${subject ? "text-xl" : ""}`}>{closed && subject ? "Alice, OTC desk" : it.title}</p>
                <p className={`mt-1.5 text-sm leading-snug ${subject ? "text-paper/70" : "text-muted"}`}>{closed && subject ? "4 linked items. Only you can see this." : it.detail}</p>
                <p className="mt-2 text-[11px] uppercase tracking-wide text-muted">{subject ? (closed ? "Identified" : "Who is this?") : it.kind === "social" ? "Public link" : it.kind === "decoy" ? "Transaction" : "Wallet"}</p>
                {closed && subject && <span className="stamp absolute -right-5 -top-5 rotate-[-8deg] rounded border-[3px] border-[#EE6A42] bg-ink px-2 py-0.5 text-lg font-bold text-[#EE6A42]">CASE CLOSED</span>}
              </article>
            );
          })}
        </div>
      </main>

      {/* The title block stays put while the board moves underneath it. */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-4 p-3 md:p-5">
        <div className="pointer-events-auto max-w-sm rounded-sm border border-line bg-card p-4 shadow-lg md:max-w-md md:p-5">
          <Logo />
          <h1 className="mt-3 text-2xl font-semibold leading-[1.02] tracking-tight md:text-4xl">Know who&apos;s behind every wallet.</h1>
          <p className="mt-2 text-sm text-muted">Start with this one. Drag the board to look around.</p>
        </div>
        <div className="pointer-events-auto flex shrink-0 items-center gap-3 text-sm">
          <Link href="/login" className="hidden hover:underline sm:inline">Sign in</Link>
          <Link href={signedIn ? "/dashboard" : "/signup"} className="rounded-md bg-accent px-3 py-2 font-medium text-accent-ink">{signedIn ? "Dashboard" : "Get started"}</Link>
        </div>
      </header>

      <div className="pointer-events-none absolute inset-x-0 bottom-16 z-30 flex justify-center px-3 md:bottom-16">
        <p aria-live="polite" className="pop pointer-events-auto max-w-xl rounded-sm border border-line bg-card px-4 py-2.5 text-center text-sm shadow-lg" key={message}>
          <span className="mr-2 font-mono text-accent">{status}</span>{message}
        </p>
      </div>

      {closed && (
        <div role="dialog" aria-modal="true" aria-labelledby="case-title" className="absolute inset-0 z-40 grid place-items-center bg-black/45 p-4">
          <div className="pop w-full max-w-lg rounded-md bg-card p-7 shadow-2xl md:p-9">
            <BrandMark size={72} />
            <h2 id="case-title" className="mt-4 text-4xl font-semibold leading-[1.02] tracking-tight md:text-5xl">You just did it.</h2>
            <p className="mt-3 text-muted">Wallets, an ENS name and a social link, grouped into one entity. That&apos;s TagAWallet, minus the string. Your notes stay private, and the name follows you onto the pages you use.</p>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <Link autoFocus href={signedIn ? "/dashboard" : "/signup"} className="inline-flex items-center gap-2 rounded-md bg-accent px-5 py-3 font-medium text-accent-ink">{signedIn ? "Open dashboard" : "Start tagging, it's free"}<span className="cta-arrow" aria-hidden>→</span></Link>
              <button type="button" onClick={() => setClosed(false)} className="font-medium hover:underline">Back to the board</button>
            </div>
            <p className="mt-6 flex flex-wrap gap-4 text-sm text-muted"><span>© {new Date().getFullYear()} TagAWallet</span><Link href="/privacy" className="hover:underline">Privacy</Link><Link href="/terms" className="hover:underline">Terms</Link></p>
          </div>
        </div>
      )}
    </div>
  );
}
