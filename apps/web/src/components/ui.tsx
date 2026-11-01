"use client";

import { useEffect, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes, forwardRef } from "react";
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

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (open && d && !d.open) d.showModal();
    if (!open && d?.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} onClose={onClose} className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-xl border border-line bg-card p-0 text-ink">
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
  if (status === "self_claimed") return <Pill tone="warn">Self-claimed</Pill>;
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
    <div className="rounded-xl border border-dashed border-line px-6 py-10 text-center">
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
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden fill="none">
        <path d="M3 4.5A1.5 1.5 0 0 1 4.5 3h7.4c.4 0 .8.16 1.06.44l7.6 7.6a1.5 1.5 0 0 1 0 2.12l-7.4 7.4a1.5 1.5 0 0 1-2.12 0l-7.6-7.6A1.5 1.5 0 0 1 3 11.9V4.5Z" fill="var(--accent)" />
        <circle cx="8" cy="8" r="1.8" fill="var(--paper)" />
      </svg>
      TagAWallet
    </span>
  );
}
