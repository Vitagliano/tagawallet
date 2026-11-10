"use client";
import Link from "next/link";
import { useEffect, useRef, type RefObject } from "react";
import { Logo } from "@/components/ui";
import { clamp, reducedMotion } from "../shared";

/** Scroll progress of a tall section, eased so wheel steps glide instead of jump. */
export function useSmoothProgress(ref: RefObject<HTMLElement | null>, cb: (p: number, raw: number) => void, rate = 9, mode: "pin" | "exit" = "pin") {
  const fn = useRef(cb);
  useEffect(() => { fn.current = cb; });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => {
      const r = el.getBoundingClientRect();
      if (mode === "exit") return clamp(-r.top / r.height);
      return r.height > innerHeight ? clamp(-r.top / (r.height - innerHeight)) : clamp((innerHeight - r.top) / r.height);
    };
    let smooth = read(), raf = 0, last = performance.now();
    fn.current(smooth, smooth);
    if (reducedMotion()) {
      const on = () => { const v = read(); fn.current(v, v); };
      addEventListener("scroll", on, { passive: true });
      return () => removeEventListener("scroll", on);
    }
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const raw = read();
      smooth += (raw - smooth) * (1 - Math.exp(-dt * rate));
      if (Math.abs(raw - smooth) < 0.0002) smooth = raw;
      fn.current(smooth, raw);
      raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(([e]) => {
      cancelAnimationFrame(raf);
      if (e.isIntersecting) { last = performance.now(); raf = requestAnimationFrame(tick); }
      else { smooth = read(); fn.current(smooth, smooth); }
    }, { rootMargin: "20% 0px" });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [ref, rate, mode]);
}

/** Floating pill nav, so it sits well on any section color. */
export function PillNav({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="pointer-events-none fixed inset-x-0 top-3 z-40 flex justify-center px-3">
      <div className="pointer-events-auto flex w-full max-w-3xl items-center justify-between rounded-full border border-line bg-card/85 py-1.5 pl-4 pr-1.5 text-ink shadow-lg backdrop-blur-md">
        <Link href="/" aria-label="TagAWallet home"><Logo /></Link>
        <nav className="flex items-center gap-3 text-sm">
          {signedIn ? <Link href="/dashboard" className="rounded-full bg-accent px-3.5 py-2 font-medium text-accent-ink">Open dashboard</Link> : (
            <>
              <Link href="/login" className="hover:underline">Sign in</Link>
              <Link href="/signup" className="rounded-full bg-accent px-3.5 py-2 font-medium text-accent-ink">Get started</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
