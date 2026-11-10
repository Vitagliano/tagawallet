"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Logo } from "@/components/ui";

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const seg = (p: number, a: number, b: number) => clamp((p - a) / (b - a));
export const ease = (t: number) => t * t * (3 - 2 * t);

export const reducedMotion = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Runs cb every frame while the element is on screen. Skipped entirely for reduced motion. */
export function useFrame(ref: RefObject<Element | null>, cb: (dt: number, t: number) => void) {
  const fn = useRef(cb);
  useEffect(() => { fn.current = cb; });
  useEffect(() => {
    if (reducedMotion() || !ref.current) return;
    let raf = 0, last = performance.now(), on = false;
    const tick = (now: number) => {
      fn.current(Math.min(0.033, (now - last) / 1000), now / 1000);
      last = now;
      raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !on) { on = true; last = performance.now(); raf = requestAnimationFrame(tick); }
      if (!e.isIntersecting && on) { on = false; cancelAnimationFrame(raf); }
    });
    io.observe(ref.current);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [ref]);
}

/** Calls cb with 0..1 as a tall section scrolls past its sticky viewport. */
export function useScrollProgress(ref: RefObject<HTMLElement | null>, cb: (p: number) => void) {
  const fn = useRef(cb);
  useEffect(() => { fn.current = cb; });
  useEffect(() => {
    let raf = 0;
    const read = () => {
      raf = 0;
      if (!ref.current) return;
      const r = ref.current.getBoundingClientRect();
      // Sections no taller than the viewport report how far they have entered it instead.
      fn.current(r.height > innerHeight ? clamp(-r.top / (r.height - innerHeight)) : clamp((innerHeight - r.top) / r.height));
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(read); };
    read();
    addEventListener("scroll", on, { passive: true });
    addEventListener("resize", on);
    return () => { removeEventListener("scroll", on); removeEventListener("resize", on); cancelAnimationFrame(raf); };
  }, [ref]);
}

export function useInView<T extends Element>(once = true) {
  const ref = useRef<T>(null);
  const [inView, set] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const io = new IntersectionObserver(([e]) => {
      set(e.isIntersecting);
      if (e.isIntersecting && once) io.disconnect();
    }, { threshold: 0.15 });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [once]);
  return [ref, inView] as const;
}

export function Reveal({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  const [ref, inView] = useInView<HTMLDivElement>();
  return <div ref={ref} data-in={inView} className={`reveal ${className}`} style={{ "--d": `${delay}ms` } as React.CSSProperties}>{children}</div>;
}

export function Cta({ signedIn, className = "", label = "Start tagging, it's free" }: { signedIn: boolean; className?: string; label?: string }) {
  return (
    <Link href={signedIn ? "/dashboard" : "/signup"} className={`inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2.5 font-medium text-accent-ink ${className}`}>
      {signedIn ? "Open dashboard" : label}<span className="cta-arrow" aria-hidden>→</span>
    </Link>
  );
}

export function Nav({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-line/60 bg-paper/70 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" aria-label="TagAWallet home"><Logo className="text-lg" /></Link>
        <nav className="flex items-center gap-3 text-sm">
          {signedIn ? <Link href="/dashboard" className="rounded-md bg-accent px-3 py-2 font-medium text-accent-ink">Open dashboard</Link> : (
            <>
              <Link href="/login" className="hover:underline">Sign in</Link>
              <Link href="/signup" className="rounded-md bg-accent px-3 py-2 font-medium text-accent-ink">Get started</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

export function FootLinks({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-wrap gap-4 text-sm ${className}`}>
      <span>© {new Date().getFullYear()} TagAWallet</span>
      <Link href="/privacy" className="hover:underline">Privacy</Link>
      <Link href="/terms" className="hover:underline">Terms</Link>
    </div>
  );
}

const TONES = {
  good: "border-good/40 bg-good/10 text-good",
  warn: "border-warn/40 bg-warn/10 text-warn",
  mine: "border-line bg-wash text-ink",
  accent: "border-accent/40 bg-accent/10 text-accent",
};
export type Tone = keyof typeof TONES;

export function Chip({ name, source, tone = "mine", className = "" }: { name: string; source?: string; tone?: Tone; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-xs font-medium ${TONES[tone]} ${className}`}>
      {name}{source && <span className="font-normal opacity-70">{source}</span>}
    </span>
  );
}

/** Deterministic so the server and client render the same addresses. */
export function fakeAddr(i: number) {
  const hex = "0123456789abcdefABCDEF";
  let s = (i + 1) * 2654435761 % 4294967296;
  const pick = (n: number) => {
    let out = "";
    for (let k = 0; k < n; k++) { s = (s * 1664525 + 1013904223) % 4294967296; out += hex[Math.floor(s / 65536) % hex.length]; }
    return out;
  };
  return `0x${pick(4)}…${pick(4)}`;
}

export const SAMPLE_TAGS: { name: string; source: string; tone: Tone }[] = [
  { name: "Exchange hot wallet", source: "Verified", tone: "good" },
  { name: "Alice, OTC desk", source: "Private", tone: "mine" },
  { name: "DAO treasury", source: "Shared", tone: "warn" },
  { name: "Market maker", source: "Shared", tone: "warn" },
  { name: "My cold storage", source: "Private", tone: "mine" },
  { name: "Bridge contract", source: "Verified", tone: "good" },
  { name: "Airdrop farmer?", source: "Private", tone: "mine" },
  { name: "Grants multisig", source: "Self-claimed", tone: "accent" },
  { name: "Team vesting", source: "Shared", tone: "warn" },
];

export const CHAINS = ["Ethereum", "Base", "Arbitrum", "Optimism", "Polygon", "BNB Chain", "Solana", "Bitcoin"];

export const POINTS = [
  { title: "Private by default", body: "Lists, notes and labels are yours alone until you invite someone. There is no public feed of what you're researching." },
  { title: "One entity, many wallets", body: "Group every address of a person, project, DAO or exchange across chains, with the links that back it up." },
  { title: "Every label shows its source", body: "Your private tag, a shared list, a self-claim or a verified profile. You always know who is saying what." },
  { title: "Where you already work", body: "Chips appear next to addresses on explorers, X and trading tools you enable. Page content never leaves your browser." },
];

export const NOT_A_WALLET = "TagAWallet is not a wallet. It holds no funds and will never ask for your seed phrase, private key or a transaction signature.";

/** A paragraph whose words light up as it scrolls through the viewport. */
export function ScrollWords({ text, className = "" }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const words = text.split(" ");
  useEffect(() => {
    const on = () => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const p = reducedMotion() ? 1 : clamp((innerHeight * 0.85 - r.top) / (innerHeight * 0.55 + r.height * 0.5));
      Array.from(el.children).forEach((c, i) => {
        (c as HTMLElement).style.opacity = String(0.16 + 0.84 * seg(p * words.length, i - 1, i + 1));
      });
    };
    on();
    addEventListener("scroll", on, { passive: true });
    addEventListener("resize", on);
    return () => { removeEventListener("scroll", on); removeEventListener("resize", on); };
  }, [words.length]);
  return <p ref={ref} className={className} aria-label={text}>{words.map((w, i) => <span key={i} aria-hidden style={{ opacity: 0.16 }}>{w} </span>)}</p>;
}

/** Oversized wordmark: each letter gets heavier and rises as the cursor nears it. */
export function ProximityWordmark({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = (e: React.PointerEvent) => {
    if (!ref.current || reducedMotion()) return;
    for (const c of Array.from(ref.current.children) as HTMLElement[]) {
      const r = c.getBoundingClientRect();
      const d = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
      const k = clamp(1 - d / (innerWidth * 0.22));
      c.style.fontVariationSettings = `"wght" ${400 + 300 * k}`;
      c.style.transform = `translateY(${-k * 5}%)`;
      c.style.color = k > 0.55 ? "var(--accent)" : "";
    }
  };
  const onLeave = () => {
    if (!ref.current) return;
    for (const c of Array.from(ref.current.children) as HTMLElement[]) { c.style.fontVariationSettings = ""; c.style.transform = ""; c.style.color = ""; }
  };
  return (
    <div ref={ref} onPointerMove={onMove} onPointerLeave={onLeave} aria-label="TagAWallet" role="img" className={`flex select-none justify-center font-normal leading-none tracking-tight ${className}`}>
      {"TagAWallet".split("").map((l, i) => <span key={i} aria-hidden className="transition-[font-variation-settings,transform,color] duration-200 ease-out">{l}</span>)}
    </div>
  );
}
