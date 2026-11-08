"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

export type ContentTransition = "morph";

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Animates only the content area (the table or the wallet), never what's around it.
 * `k` names what's shown; when it changes, one card stays on screen and glides from the old height to the new,
 * while the old content fades out on top and the new fades in underneath, so the surface itself seems to become the other view.
 */
export function ContentSurface({ k, variant, children }: { k: string; variant: ContentTransition; children: React.ReactNode }) {
  const last = useRef<{ k: string; node: React.ReactNode }>({ k, node: children });
  const [prev, setPrev] = useState<{ k: string; node: React.ReactNode } | null>(null);
  const [changed, setChanged] = useState(false);
  const measure = useRef<HTMLDivElement>(null);
  const lastHeight = useRef(0);
  const [box, setBox] = useState<number | null>(null);
  const morphing = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Notice a change of view before paint, so the old content is still there for its exit.
  useLayoutEffect(() => {
    if (last.current.k !== k && !reduced()) {
      const old = last.current;
      setChanged(true);
      setPrev(old);
      if (variant === "morph") {
        morphing.current = true;
        setBox(lastHeight.current);
        const to = measure.current?.offsetHeight ?? lastHeight.current;
        requestAnimationFrame(() => requestAnimationFrame(() => setBox(to)));
      }
      // A timer in a ref (not this effect's cleanup): this effect runs on every render and must not cancel it.
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => { setPrev(null); morphing.current = false; setBox(null); }, variant === "morph" ? 340 : 130);
    }
    last.current = { k, node: children };
  });
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  // Keep the current height on hand; while morphing, follow it if the new content grows (e.g. once its data loads).
  useEffect(() => {
    const el = measure.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      lastHeight.current = el.offsetHeight;
      if (morphing.current) setBox(el.offsetHeight);
    });
    ro.observe(el);
    lastHeight.current = el.offsetHeight;
    return () => ro.disconnect();
  }, []);

  return (
    <div className="relative overflow-hidden rounded-2xl bg-card transition-[height] duration-300 ease-[cubic-bezier(0.2,0,0,1)]"
      style={box != null ? { height: box } : undefined}>
      <div ref={measure}>
        <div key={k} className={changed ? "motion-safe:animate-[morph-in_260ms_ease-out_60ms_both]" : ""}>{children}</div>
      </div>
      {prev && (
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 motion-safe:animate-[morph-out_140ms_ease-in_forwards]">{prev.node}</div>
      )}
    </div>
  );
}
