"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { MARK_FILL } from "@/components/brand-mark";
import { TAG_PARTS, WALLET_PARTS } from "@/components/brand-mark-paths";
import { Logo } from "@/components/ui";
import { SHELL, SurfBrowser } from "@/components/landing/v5/surf";
import { useSmoothProgress } from "@/components/landing/v3/kit";
import { CHAINS, FootLinks, reducedMotion, useFrame } from "../shared";

const ORANGE = "#EE6A42";
const INK = "#1a1a18";
const AMBER = "#E9B44C";

/** Place the separated assets into the full 515×415 mark. */
const WALLET_SHIFT = "translate(147.7 0)";
const TAG_SHIFT = "translate(0.4 83)";

type Theme = "dark" | "light";

const THEME: Record<Theme, CSSProperties> = {
  dark: {
    colorScheme: "dark",
    background: "#141412",
    color: "#efece3",
    ["--paper" as string]: "#141412",
    ["--card" as string]: "#1c1c19",
    ["--ink" as string]: "#efece3",
    ["--muted" as string]: "#9c988b",
    ["--line" as string]: "#33322c",
    ["--accent" as string]: "#ee6a42",
    ["--accent-ink" as string]: "#1a0d07",
    ["--wash" as string]: "#25241f",
    ["--good" as string]: "#55c58d",
    ["--warn" as string]: "#dbab45",
    ["--bad" as string]: "#f2837b",
    ["--color-paper" as string]: "#141412",
    ["--color-card" as string]: "#1c1c19",
    ["--color-ink" as string]: "#efece3",
    ["--color-muted" as string]: "#9c988b",
    ["--color-line" as string]: "#33322c",
    ["--color-accent" as string]: "#ee6a42",
    ["--color-accent-ink" as string]: "#1a0d07",
    ["--color-wash" as string]: "#25241f",
    ["--color-good" as string]: "#55c58d",
    ["--color-warn" as string]: "#dbab45",
    ["--color-bad" as string]: "#f2837b",
  },
  light: {
    colorScheme: "light",
    background: "#f6f4ee",
    color: "#1a1a18",
    ["--paper" as string]: "#f6f4ee",
    ["--card" as string]: "#fffefb",
    ["--ink" as string]: "#1a1a18",
    ["--muted" as string]: "#6a675e",
    ["--line" as string]: "#dfdbcf",
    ["--accent" as string]: "#c8421b",
    ["--accent-ink" as string]: "#ffffff",
    ["--wash" as string]: "#efece2",
    ["--good" as string]: "#1b7a4a",
    ["--warn" as string]: "#9a6a00",
    ["--bad" as string]: "#b3261e",
    ["--color-paper" as string]: "#f6f4ee",
    ["--color-card" as string]: "#fffefb",
    ["--color-ink" as string]: "#1a1a18",
    ["--color-muted" as string]: "#6a675e",
    ["--color-line" as string]: "#dfdbcf",
    ["--color-accent" as string]: "#c8421b",
    ["--color-accent-ink" as string]: "#ffffff",
    ["--color-wash" as string]: "#efece2",
    ["--color-good" as string]: "#1b7a4a",
    ["--color-warn" as string]: "#9a6a00",
    ["--color-bad" as string]: "#b3261e",
  },
};

/* ---------- Dashboard-style top nav ---------- */

function DashNav({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="sticky top-0 z-40 bg-paper/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 md:px-6">
        <Link href="/" aria-label="TagAWallet home" className="shrink-0"><Logo className="text-lg" /></Link>
        <div className="ml-auto flex items-center gap-2">
          {signedIn
            ? <Link href="/dashboard" className="inline-flex h-9 items-center rounded-xl bg-accent px-3 text-sm font-semibold text-accent-ink hover:opacity-90">Open dashboard</Link>
            : (
              <>
                <Link href="/login" className="inline-flex h-9 items-center rounded-xl px-3 text-sm font-medium text-muted transition hover:bg-card/60 hover:text-ink">Sign in</Link>
                <Link href="/signup" className="inline-flex h-9 items-center rounded-xl bg-accent px-3 text-sm font-semibold text-accent-ink hover:opacity-90">Get started</Link>
              </>
            )}
        </div>
      </div>
    </header>
  );
}

/* ---------- Hero: one viewport, intact mark, light parallax ---------- */

function Hero({ signedIn }: { signedIn: boolean }) {
  const root = useRef<HTMLElement>(null);
  const wallet = useRef<SVGGElement>(null);
  const tag = useRef<SVGGElement>(null);
  const sparks = useRef<SVGGElement>(null);
  const cursor = useRef({ x: 0, y: 0, tx: 0, ty: 0 });

  const paint = (t: number) => {
    const c = cursor.current;
    if (wallet.current) wallet.current.style.transform = `translate(${c.x * 8}px, ${c.y * 8}px)`;
    if (tag.current) tag.current.style.transform = `translate(${c.x * 18}px, ${c.y * 18 + Math.sin(t * 1.2) * 3}px) rotate(${c.x * -2}deg)`;
    if (sparks.current) {
      sparks.current.style.transform = `translate(${Math.cos(t * 1.4) * 3}px, ${Math.sin(t * 2) * 4}px)`;
    }
  };

  useFrame(root, (dt, t) => {
    const c = cursor.current, k = 1 - Math.pow(0.002, dt);
    c.x += (c.tx - c.x) * k; c.y += (c.ty - c.y) * k;
    paint(t);
  });

  useEffect(() => {
    if (!reducedMotion()) return;
    paint(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tagBody = TAG_PARTS.find((p) => p.id === "tag")!;
  const personParts = TAG_PARTS.filter((p) => p.id === "shoulders" || p.id === "head");
  const sparkParts = TAG_PARTS.filter((p) => p.id.startsWith("spark"));

  return (
    <section
      ref={root}
      onPointerMove={(e) => {
        cursor.current.tx = (e.clientX / innerWidth - 0.5) * 2;
        cursor.current.ty = (e.clientY / innerHeight - 0.5) * 2;
      }}
      className="relative flex min-h-[calc(100dvh-3.75rem)] flex-col items-center justify-center overflow-hidden px-5 pb-16 pt-10"
      aria-label="Introduction"
    >
      <div className="relative z-10 mx-auto max-w-3xl text-center">
        <p className="rise text-sm font-semibold tracking-[0.2em] text-muted uppercase">TagAWallet</p>
        <h1 className="rise mt-3 text-4xl font-semibold leading-[1.02] tracking-tight md:text-6xl" style={{ "--d": "80ms" } as React.CSSProperties}>
          A name for every wallet you care about.
        </h1>
        <p className="rise mx-auto mt-4 max-w-xl text-muted md:text-lg" style={{ "--d": "160ms" } as React.CSSProperties}>
          Tag once. See it wherever you research and trade.
        </p>
        <div className="rise mt-6" style={{ "--d": "240ms" } as React.CSSProperties}>
          <Link href={signedIn ? "/dashboard" : "/signup"} className="inline-flex h-11 items-center gap-2 rounded-xl bg-accent px-5 text-base font-semibold text-accent-ink hover:opacity-90">
            {signedIn ? "Open dashboard" : "Start tagging, it's free"}<span className="cta-arrow" aria-hidden>→</span>
          </Link>
        </div>
      </div>

      <svg viewBox="0 0 515 415" className="relative z-0 mt-10 w-[min(72vw,28rem)] overflow-visible text-ink md:mt-14 md:w-[min(52vw,34rem)]" aria-hidden fill="none">
        <g transform={WALLET_SHIFT}>
          <g ref={wallet} style={{ willChange: "transform" }}>
            {WALLET_PARTS.map((part) => (
              <path key={part.id} d={part.d} fill={MARK_FILL[part.tone]} fillRule={part.evenodd ? "evenodd" : undefined} clipRule={part.evenodd ? "evenodd" : undefined} />
            ))}
          </g>
        </g>
        <g transform={TAG_SHIFT}>
          <g ref={tag} style={{ transformOrigin: "198px 91px", willChange: "transform" }}>
            <path d={tagBody.d} fill={MARK_FILL[tagBody.tone]} fillRule={tagBody.evenodd ? "evenodd" : undefined} clipRule={tagBody.evenodd ? "evenodd" : undefined} />
            {personParts.map((part) => (
              <path key={part.id} d={part.d} fill={MARK_FILL[part.tone]} />
            ))}
            <g ref={sparks} style={{ willChange: "transform" }}>
              {sparkParts.map((part) => (
                <path key={part.id} d={part.d} fill={MARK_FILL[part.tone]} />
              ))}
            </g>
          </g>
        </g>
      </svg>
    </section>
  );
}

/* ---------- Chat: one sticky beat ---------- */

const LONG_ADDR = "0x4c1fA8e27B03d96E5f71aC28D04bE6637fA92c15";
const BEATS = [
  { from: "them", at: 0.1, text: "Who did we pay last week?" },
  { from: "me", at: 0.28, text: "addr" },
  { from: "them", at: 0.46, text: "That's not a who." },
  { from: "me", at: 0.6, text: "It's all I've got." },
  { from: "them", at: 0.88, text: "Alice — why didn't you just say so?" },
];
const STAMP_AT = 0.74;

function Bubble({ from, children }: { from: string; children: ReactNode }) {
  const mine = from === "me";
  return (
    <div className={`pop w-fit max-w-[92%] origin-bottom rounded-[1.4rem] px-4 py-2.5 text-base shadow-lg md:px-6 md:py-3.5 md:text-2xl ${mine ? "ml-auto rounded-br-md bg-ink text-paper" : "rounded-bl-md bg-card text-ink"}`}>{children}</div>
  );
}

function Typing({ from }: { from: string }) {
  return (
    <Bubble from={from}>
      <span className="flex h-6 items-center gap-1" aria-label="Typing">
        {[0, 1, 2].map((i) => <span key={i} className="typing-dot size-1.5 rounded-full bg-current" style={{ animationDelay: `${i * 130}ms` }} />)}
      </span>
    </Bubble>
  );
}

function Sparks({ on }: { on: boolean }) {
  if (!on) return null;
  return (
    <span className="pointer-events-none absolute left-1/2 top-1/2" aria-hidden>
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2, d = 70 + (i % 3) * 34;
        return (
          <span key={i} className="absolute h-3 w-1.5 rounded-full" style={{
            background: i % 2 ? AMBER : "#fff", transform: `rotate(${a + Math.PI / 2}rad)`,
          }} ref={(el) => {
            el?.animate([{ translate: "0 0", opacity: 1 }, { translate: `${Math.cos(a) * d}px ${Math.sin(a) * d}px`, opacity: 0 }], { duration: 620, easing: "cubic-bezier(.1,.8,.3,1)", fill: "forwards" });
          }} />
        );
      })}
    </span>
  );
}

function Chat() {
  const root = useRef<HTMLElement>(null);
  const [p, setP] = useState(0);
  useSmoothProgress(root, (v) => setP((old) => (Math.abs(old - v) > 0.002 ? v : old)));
  const stamped = p >= STAMP_AT;
  return (
    <section ref={root} className="h-[180vh]" style={{ background: ORANGE, color: INK }} aria-label="Why addresses need names">
      <div className="sticky top-0 flex h-dvh items-center overflow-hidden">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-8 px-5 pt-16 md:grid-cols-[1fr_1.05fr] md:gap-14 md:pt-0">
          <h2 className="text-[clamp(2.4rem,5.6vw,5.5rem)] font-semibold leading-[1] tracking-[-0.03em]">
            A hex string isn&apos;t a who.
            <span className={`block transition-all duration-500 ${p >= 0.9 ? "translate-y-0 text-white opacity-100" : "translate-y-3 opacity-0"}`}>A name is.</span>
          </h2>
          <div className="flex min-h-[320px] flex-col justify-end gap-2.5 md:min-h-[400px] md:gap-3" aria-live="polite">
            {BEATS.map((b, i) => {
              if (p < b.at - 0.06) return null;
              if (p < b.at) return <Typing key={i} from={b.from} />;
              if (b.text !== "addr") return <Bubble key={i} from={b.from}>{b.text}</Bubble>;
              return (
                <Bubble key={i} from={b.from}>
                  <span className="relative block">
                    <span className={`addr block break-all text-sm leading-snug transition-all duration-300 md:text-lg ${stamped ? "scale-[.97] opacity-25 blur-[1.5px]" : ""}`}>{LONG_ADDR}</span>
                    {stamped && (
                      <span className="stamp absolute inset-0 grid place-items-center">
                        <span className="whitespace-nowrap rounded-l-full rounded-r-xl px-4 py-1.5 text-lg font-semibold shadow-xl md:text-3xl" style={{ background: ORANGE, color: INK }}>Alice, OTC desk</span>
                      </span>
                    )}
                    <Sparks on={stamped} />
                  </span>
                </Bubble>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Surf ---------- */

function SurfSection({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="border-t border-line bg-paper px-3 pb-12 pt-16 md:px-6 md:pb-16 md:pt-20" aria-label="Try the extension">
      <div className="mx-auto max-w-6xl">
        <h2 className="max-w-3xl text-[clamp(2rem,4.5vw,3.75rem)] font-semibold leading-[1.02] tracking-tight">
          Tag it once. Meet it again on every site.
        </h2>
        <p className="mt-3 max-w-2xl text-muted md:text-lg">
          Name the mystery wallet, then flip through the tabs — the tag follows you.
        </p>
        <div className="mt-8 h-[min(78dvh,820px)]" style={SHELL}>
          <SurfBrowser signedIn={signedIn} className="h-full" />
        </div>
      </div>
    </section>
  );
}

/* ---------- Close ---------- */

function ThemeSwitcher({ theme, onChange }: { theme: Theme; onChange: (t: Theme) => void }) {
  return (
    <div role="group" aria-label="Theme" className="inline-flex items-center gap-1 rounded-xl bg-black/15 p-1">
      {(["dark", "light"] as const).map((t) => (
        <button
          key={t}
          type="button"
          aria-pressed={theme === t}
          onClick={() => onChange(t)}
          className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition ${theme === t ? "bg-[#1a0d07] text-white" : "text-[#1a0d07]/70 hover:text-[#1a0d07]"}`}
        >
          <span aria-hidden>{t === "dark" ? "◐" : "〇"}</span>
          {t === "dark" ? "Dark" : "Light"}
        </button>
      ))}
    </div>
  );
}

function BrandFooter({ signedIn, theme, onTheme }: { signedIn: boolean; theme: Theme; onTheme: (t: Theme) => void }) {
  return (
    <footer className="overflow-hidden bg-[#EE6A42] text-[#1a0d07]">
      <div className="mx-auto w-full max-w-6xl px-5 pb-16 pt-20 md:px-6 md:pt-24">
        <p className="max-w-3xl text-5xl font-semibold leading-[1] tracking-tight md:text-7xl">Tag your first wallet.</p>
        <p className="mt-4 max-w-xl text-base md:text-lg">Not a wallet — it holds no funds and never asks for a seed phrase.</p>
        <Link href={signedIn ? "/dashboard" : "/signup"} className="mt-7 inline-flex h-11 items-center gap-2 rounded-xl bg-[#1a0d07] px-5 font-semibold text-white hover:opacity-90">
          {signedIn ? "Open dashboard" : "Start tagging, it's free"}<span className="cta-arrow" aria-hidden>→</span>
        </Link>
        <div className="mt-12 flex flex-wrap items-center justify-between gap-4">
          <ThemeSwitcher theme={theme} onChange={onTheme} />
          <p className="text-sm font-medium">{CHAINS.join("  ·  ")}</p>
        </div>
        <FootLinks className="mt-4" />
      </div>
    </footer>
  );
}

export function BlendLanding({ signedIn }: { signedIn: boolean }) {
  const [theme, setTheme] = useState<Theme>("dark");
  const onTheme = useCallback((t: Theme) => setTheme(t), []);

  useEffect(() => {
    const prev = document.documentElement.dataset.theme;
    document.documentElement.dataset.theme = theme;
    return () => {
      if (prev) document.documentElement.dataset.theme = prev;
      else delete document.documentElement.dataset.theme;
    };
  }, [theme]);

  return (
    <div style={THEME[theme]} className="min-h-dvh bg-paper text-ink">
      <DashNav signedIn={signedIn} />
      <main>
        <Hero signedIn={signedIn} />
        <Chat />
        <SurfSection signedIn={signedIn} />
      </main>
      <BrandFooter signedIn={signedIn} theme={theme} onTheme={onTheme} />
    </div>
  );
}
