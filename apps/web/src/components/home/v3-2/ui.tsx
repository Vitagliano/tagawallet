"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Small shared pieces for v3.2, following the ui-skills playbook:
 * outline icons at a 1.5px stroke (beside regular text), press feedback at 0.96,
 * and hit areas grown to 44px without changing the layout.
 */

/** Press feedback: a subtle scale while held, eased so it never wobbles. */
export const press = "transition-[transform,background-color,color] duration-150 ease-out active:scale-[0.96]";
/** Grows the clickable area of a small control to at least 44×44 without moving anything. */
export const hit = "relative after:absolute after:top-1/2 after:left-1/2 after:size-11 after:-translate-x-1/2 after:-translate-y-1/2 after:content-['']";

const PATHS = {
  search: <><circle cx="7" cy="7" r="4.25" /><path d="m10.25 10.25 3 3" /></>,
  chevronDown: <path d="M4.5 6.5 8 10l3.5-3.5" />,
  chevronLeft: <path d="M9.5 4.5 6 8l3.5 3.5" />,
  chevronRight: <path d="M6.5 4.5 10 8l-3.5 3.5" />,
  arrowUp: <path d="M8 12.5v-9M4.5 7 8 3.5 11.5 7" />,
  arrowDown: <path d="M8 3.5v9M4.5 9 8 12.5 11.5 9" />,
  x: <path d="m4.5 4.5 7 7m0-7-7 7" />,
  more: <><circle cx="4" cy="8" r=".75" /><circle cx="8" cy="8" r=".75" /><circle cx="12" cy="8" r=".75" /></>,
  copy: <><rect x="5.5" y="5.5" width="7" height="7" rx="1.5" /><path d="M10.5 5.5v-1A1.5 1.5 0 0 0 9 3H4.5A1.5 1.5 0 0 0 3 4.5V9a1.5 1.5 0 0 0 1.5 1.5h1" /></>,
  check: <path d="m3.5 8.5 3 3 6-7" />,
  external: <path d="M6.5 3.5h-2a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1v-2M9 3.5h3.5V7M12.5 3.5 7.5 8.5" />,
  plus: <path d="M8 3.5v9M3.5 8h9" />,
  trash: <path d="M3.5 4.5h9M6.5 4.5V3.5h3v1M5 4.5l.5 8h5l.5-8" />,
  filter: <path d="M3 4.5h10M5 8h6M7 11.5h2" />,
  sort: <path d="M5 3.5v9M2.75 10.25 5 12.5l2.25-2.25M11 12.5v-9M8.75 5.75 11 3.5l2.25 2.25" />,
} as const;
export type IconName = keyof typeof PATHS;

export function Icon({ name, className = "size-4", strokeWidth = 1.5 }: { name: IconName; className?: string; strokeWidth?: number }) {
  return (
    <svg aria-hidden viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${className}`}>
      {PATHS[name]}
    </svg>
  );
}

/** A quiet square icon button: 32px to look at, 44px to hit. */
export function IconButton({ icon, label, onClick, disabled, className = "" }: { icon: IconName; label: string; onClick: () => void; disabled?: boolean; className?: string }) {
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick}
      className={`grid size-8 place-items-center rounded-lg text-muted hover:bg-wash hover:text-ink disabled:pointer-events-none disabled:opacity-30 ${press} ${hit} ${className}`}>
      <Icon name={icon} />
    </button>
  );
}

/** Copy with an icon that cross-fades to a check (opacity, scale and blur) instead of swapping the label. */
export function CopyButton({ text, className = "" }: { text: string; className?: string }) {
  const [done, setDone] = useState(false);
  const swap = "absolute inset-0 m-auto transition-[opacity,scale,filter] duration-200 ease-out";
  return (
    <button type="button" onClick={async () => { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); }}
      className={`inline-flex items-center gap-1.5 ${press} ${hit} ${className}`}>
      <span className="relative size-3.5">
        <span className={`${swap} ${done ? "scale-50 opacity-0 blur-[2px]" : ""}`}><Icon name="copy" className="size-3.5" /></span>
        <span className={`${swap} ${done ? "" : "scale-50 opacity-0 blur-[2px]"}`}><Icon name="check" className="size-3.5" /></span>
      </span>
      <span>Copy</span>
      <span aria-live="polite" className="sr-only">{done ? "Copied" : ""}</span>
    </button>
  );
}

/** Placeholder bars shaped like the text they stand in for. */
export const Bone = ({ className }: { className: string }) => <span aria-hidden className={`block rounded bg-wash motion-safe:animate-[skeleton_1.4s_ease-in-out_infinite] ${className}`} />;

/**
 * One line of text that fades at the end only when it doesn't fit (never a hard "…").
 * Text that fits is left alone, so short names never look washed out.
 */
export function FadeText({ children, className = "", title, style }: { children: React.ReactNode; className?: string; title?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [over, setOver] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setOver(el.scrollWidth > el.clientWidth + 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [children]);
  return <span ref={ref} title={over ? title ?? (typeof children === "string" ? children : undefined) : undefined} data-overflow={over || undefined} style={style} className={`fade-end block ${className}`}>{children}</span>;
}
