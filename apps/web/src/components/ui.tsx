"use client";

import { BrandMark } from "./brand-mark";
import { IconButton } from "./home/v3-2/ui";
import { useCallback, useEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes, forwardRef } from "react";
import { CHAINS, type ChainId, truncateAddress } from "@tagawallet/shared";

const VARIANTS = {
  primary: "bg-accent text-accent-ink hover:opacity-90",
  secondary: "border border-line bg-card hover:bg-wash",
  ghost: "hover:bg-wash",
  danger: "border border-bad text-bad hover:bg-bad hover:text-card",
};

export function Button({ variant = "secondary", className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof VARIANTS }) {
  return <button type="button" className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium transition disabled:opacity-50 ${VARIANTS[variant]} ${className}`} {...props} />;
}

const fieldClass = "rounded-md border border-line bg-card px-3 py-2 text-sm placeholder:text-muted/70 aria-invalid:border-bad";

// Full width unless the caller sets its own width. Tailwind can't let a later class win by order.
const field = (className: string) => `${fieldClass} ${/\bw-auto\b/.test(className) ? "" : "w-full"} ${className}`;

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className = "", ...p }, ref) {
  return <input ref={ref} className={field(className)} {...p} />;
});
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className = "", ...p }, ref) {
  return <textarea ref={ref} className={field(className)} {...p} />;
});
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className = "", ...p }, ref) {
  return <select ref={ref} className={field(className)} {...p} />;
});

export function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {error ? <span role="alert" className="block text-sm text-bad">{error}</span> : hint ? <span className="block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

/** A panel that floats over the right edge, like the wallet peek: no backdrop, nothing underneath moves. Esc closes. */
function FloatingPanel({ open, onClose, title, children, fit }: { open: boolean; onClose: () => void; title: string; children: ReactNode; fit?: boolean }) {
  const [leaving, setLeaving] = useState(false);
  const close = useCallback(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return onClose();
    setLeaving(true);
    setTimeout(() => { setLeaving(false); onClose(); }, 120);
  }, [onClose]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);
  if (!open) return null;
  // Default stretches top→bottom (wallet peek). `fit` hugs content, still docked to the bottom edge.
  const place = fit
    ? "inset-x-2 bottom-2 max-h-[85dvh] md:inset-x-auto md:top-auto md:right-4 md:bottom-4 md:max-h-[calc(100dvh-6rem)] md:w-[24rem]"
    : "inset-x-2 bottom-2 max-h-[85dvh] md:inset-x-auto md:top-20 md:right-4 md:bottom-4 md:max-h-none md:w-[24rem]";
  return (
    <aside role="dialog" aria-modal="false" aria-label={title}
      className={`fixed z-30 flex flex-col overflow-hidden surface-raised rounded-2xl text-ink ${place} ${leaving ? "motion-safe:animate-[panel-out_120ms_ease-in_forwards]" : "motion-safe:animate-[panel-in_180ms_ease-out]"}`}>
      <span aria-hidden className="mx-auto mt-2 h-1 w-10 rounded-full bg-line md:hidden" />
      <div className="flex items-center justify-between gap-2 py-2 pr-2 pl-4">
        <h2 className="min-w-0 truncate text-base font-semibold">{title}</h2>
        <IconButton icon="x" label="Close (Esc)" onClick={close} />
      </div>
      {children}
    </aside>
  );
}

export function Modal({ open, onClose, title, children, variant = "dialog", fit }: { open: boolean; onClose: () => void; title: string; children: ReactNode; variant?: "dialog" | "drawer"; fit?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (open && d && !d.open) d.showModal();
    if (!open && d?.open) d.close();
  }, [open]);
  if (variant === "drawer") return <FloatingPanel open={open} onClose={onClose} title={title} fit={fit}>{children}</FloatingPanel>;
  return (
    <dialog ref={ref} onClose={onClose} aria-label={title} className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl bg-card p-0 text-ink">
      {open && (
        <div className="p-5">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold">{title}</h2>
            <Button variant="ghost" aria-label="Close" onClick={onClose}>✕</Button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

export function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "accent" | "good" | "warn" | "bad" }) {
  const tones = { neutral: "bg-wash text-muted", accent: "bg-accent/15 text-accent", good: "bg-good/15 text-good", warn: "bg-warn/15 text-warn", bad: "bg-bad/15 text-bad" };
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export function VisibilityPill({ visibility }: { visibility: string }) {
  if (visibility === "public") return <Pill tone="accent">Public</Pill>;
  if (visibility === "shared") return <Pill tone="warn">Shared</Pill>;
  return <Pill>Private</Pill>;
}

export function VerificationPill({ status }: { status?: string }) {
  if (status === "verified") return <Pill tone="good">✓ Verified</Pill>;
  if (status === "self_claimed" || status === "community") return <Pill>Published by you</Pill>;
  return <Pill>Unverified</Pill>;
}

export const STATUS_TONES: Record<string, "good" | "bad" | "accent" | "neutral"> = { mine: "accent", trusted: "good", scam: "bad", watchlist: "neutral" };

export function StatusPill({ status }: { status?: string }) {
  if (!status || status === "none") return null;
  return <Pill tone={STATUS_TONES[status] ?? "neutral"}>{status}</Pill>;
}

export function ChainName({ chain }: { chain: string }) {
  return <>{CHAINS[chain as ChainId]?.name ?? chain}</>;
}

export function Address({ value, full }: { value: string; full?: boolean }) {
  return <span className="addr" title={value}>{full ? value : truncateAddress(value)}</span>;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl bg-card px-6 py-10 text-center">
      <p className="font-medium">{title}</p>
      {children && <div className="mt-2 text-sm text-muted">{children}</div>}
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return children ? <p role="alert" className="rounded-md bg-bad/10 px-3 py-2 text-sm text-bad">{children}</p> : null;
}
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-semibold tracking-tight ${className}`}>
      <BrandMark size={26} />
      TagAWallet
    </span>
  );
}
