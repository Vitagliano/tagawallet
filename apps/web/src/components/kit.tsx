"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import useSWR from "swr";
import { api, fetcher } from "@/lib/client";

// ---- Toasts, with undo for anything destructive ----

type Toast = { id: number; message: string; undo?: () => void };
type ToastApi = {
  toast: (message: string) => void;
  /** Hides the change now and commits it after a few seconds unless Undo is pressed. */
  undoable: (message: string, commit: () => Promise<unknown>, onUndo?: () => void) => void;
};
const ToastContext = createContext<ToastApi>({ toast: () => {}, undoable: (_m, c) => void c() });
export const useToast = () => useContext(ToastContext);

const UNDO_MS = 5000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const pending = useRef(new Map<number, () => Promise<unknown>>());
  const seq = useRef(0);
  const drop = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const toast = useCallback((message: string) => {
    const id = ++seq.current;
    setToasts((t) => [...t, { id, message }]);
    setTimeout(() => drop(id), 3000);
  }, [drop]);

  const undoable = useCallback((message: string, commit: () => Promise<unknown>, onUndo?: () => void) => {
    const id = ++seq.current;
    pending.current.set(id, commit);
    const timer = setTimeout(() => {
      const run = pending.current.get(id);
      pending.current.delete(id);
      drop(id);
      void run?.();
    }, UNDO_MS);
    setToasts((t) => [...t, { id, message, undo: () => { clearTimeout(timer); pending.current.delete(id); drop(id); onUndo?.(); } }]);
  }, [drop]);

  // Leaving the page commits whatever is still waiting, rather than silently dropping it.
  useEffect(() => {
    const flush = () => { for (const run of pending.current.values()) void run(); pending.current.clear(); };
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, []);

  return (
    <ToastContext.Provider value={{ toast, undoable }}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div key={t.id} role="status" className="pointer-events-auto flex items-center gap-4 rounded-lg bg-ink px-4 py-2.5 text-sm text-paper shadow-lg">
            <span>{t.message}</span>
            {t.undo && <button className="font-semibold underline-offset-2 hover:underline" onClick={t.undo}>Undo</button>}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ---- Status, as one-tap chips ----

export const QUICK_STATUSES = [
  { value: "mine", label: "Mine", tone: "bg-accent" },
  { value: "trusted", label: "Trusted", tone: "bg-good" },
  { value: "watchlist", label: "Watchlist", tone: "bg-warn" },
  { value: "scam", label: "Scam", tone: "bg-bad" },
] as const;

export function StatusDot({ status }: { status?: string }) {
  const s = QUICK_STATUSES.find((x) => x.value === status);
  if (!status || status === "none") return null;
  return <span className="inline-flex items-center gap-1 rounded-full bg-wash px-2 py-0.5 text-xs font-medium"><span aria-hidden className={`size-1.5 rounded-full ${s?.tone ?? "bg-muted"}`} />{s?.label ?? status}</span>;
}

// ---- Tags, as chips with suggestions ----

export function TagInput({ value, onChange, label = "Tags", placeholder = "Add a tag" }: { value: string[]; onChange: (v: string[]) => void; label?: string; placeholder?: string }) {
  const [draft, setDraft] = useState("");
  const { data } = useSWR<{ tags: string[] }>("/api/tags", fetcher);
  const id = useRef(`tags-${Math.random().toString(36).slice(2)}`).current;
  const add = (raw: string) => {
    const next = raw.split(",").map((t) => t.trim().toLowerCase()).filter((t) => t && !value.includes(t));
    if (next.length) onChange([...value, ...next]);
    setDraft("");
  };
  return (
    <div className="flex min-h-9 flex-wrap items-center gap-1 rounded-md border border-line bg-card px-1.5 py-1 focus-within:outline-2 focus-within:outline-accent">
      {value.map((t) => (
        <span key={t} className="inline-flex items-center gap-1 rounded-full bg-wash py-0.5 pr-1 pl-2 text-xs font-medium">
          {t}<button type="button" aria-label={`Remove ${t}`} className="rounded-full px-1 text-muted hover:text-ink" onClick={() => onChange(value.filter((x) => x !== t))}>✕</button>
        </span>
      ))}
      <input
        aria-label={label} list={id} value={draft} placeholder={value.length ? "" : placeholder}
        className="min-w-24 flex-1 bg-transparent px-1 py-0.5 text-sm outline-none placeholder:text-muted/70"
        onChange={(e) => { if (e.target.value.endsWith(",")) add(e.target.value); else setDraft(e.target.value); }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && draft.trim()) { e.preventDefault(); add(draft); }
          if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={() => draft.trim() && add(draft)}
      />
      <datalist id={id}>{data?.tags.filter((t) => !value.includes(t)).map((t) => <option key={t} value={t} />)}</datalist>
    </div>
  );
}

// ---- Labels: the built-in ones and your own, in one picker ----

export type Labels = { status: string; tags: string[] };

/** Built-ins are stored as the wallet's status (one at a time), your own as its tags. People just see labels. */
export function LabelPicker({ value, onChange, label = "Labels" }: { value: Labels; onChange: (v: Labels) => void; label?: string }) {
  const [draft, setDraft] = useState("");
  const { data } = useSWR<{ tags: string[] }>("/api/tags", fetcher);
  const id = useRef(`labels-${Math.random().toString(36).slice(2)}`).current;
  const builtIn = QUICK_STATUSES.some((s) => s.value === value.status);
  const add = (raw: string) => {
    const words = raw.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
    let { status, tags } = value;
    for (const w of words) {
      // Typing a built-in name picks the built-in, so "scam" never ends up as two different things.
      if (QUICK_STATUSES.some((s) => s.value === w)) status = w;
      else if (!tags.includes(w)) tags = [...tags, w];
    }
    if (status !== value.status || tags !== value.tags) onChange({ status, tags });
    setDraft("");
  };
  return (
    <div role="group" aria-label={label} className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {QUICK_STATUSES.map((s) => {
          const on = value.status === s.value;
          return (
            <button key={s.value} type="button" aria-pressed={on} onClick={() => onChange({ ...value, status: on ? "none" : s.value })}
              className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition ${on ? "border-ink/30 bg-wash text-ink" : "border-line text-muted hover:bg-wash hover:text-ink"}`}>
              <span aria-hidden className={`size-2 rounded-full ${s.tone}`} />{s.label}
            </button>
          );
        })}
        {!builtIn && value.status && value.status !== "none" && (
          <button type="button" aria-pressed onClick={() => onChange({ ...value, status: "none" })} className="inline-flex h-7 items-center gap-1 rounded-full border border-ink/30 bg-wash px-2.5 text-xs font-medium">{value.status} ✕</button>
        )}
      </div>
      <div className="flex min-h-9 flex-wrap items-center gap-1 rounded-md border border-line bg-card px-1.5 py-1 focus-within:outline-2 focus-within:outline-accent">
        {value.tags.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-full bg-wash py-0.5 pr-1 pl-2 text-xs font-medium">
            {t}<button type="button" aria-label={`Remove ${t}`} className="rounded-full px-1 text-muted hover:text-ink" onClick={() => onChange({ ...value, tags: value.tags.filter((x) => x !== t) })}>✕</button>
          </span>
        ))}
        <input
          aria-label="Add a label" list={id} value={draft} placeholder={value.tags.length ? "" : "Your own labels, e.g. trader, whale"}
          className="min-w-24 flex-1 bg-transparent px-1 py-0.5 text-sm outline-none placeholder:text-muted/70"
          onChange={(e) => { if (e.target.value.endsWith(",")) add(e.target.value); else setDraft(e.target.value); }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && draft.trim()) { e.preventDefault(); add(draft); }
            if (e.key === "Backspace" && !draft && value.tags.length) onChange({ ...value, tags: value.tags.slice(0, -1) });
          }}
          onBlur={() => draft.trim() && add(draft)}
        />
        <datalist id={id}>{data?.tags.filter((t) => !value.tags.includes(t)).map((t) => <option key={t} value={t} />)}</datalist>
      </div>
    </div>
  );
}

/** One chip per label, built-in first, for tables and cards. */
export function LabelChips({ status, tags = [], max = 4 }: { status?: string; tags?: string[]; max?: number }) {
  const shown = tags.slice(0, Math.max(0, max - (status && status !== "none" ? 1 : 0)));
  return (
    <span className="flex flex-wrap items-center gap-1">
      <StatusDot status={status} />
      {shown.map((t) => <span key={t} className="rounded-full bg-wash px-2 py-0.5 text-xs font-medium text-muted">{t}</span>)}
      {tags.length > shown.length && <span className="text-xs text-muted">+{tags.length - shown.length}</span>}
    </span>
  );
}

/** A short line under a page title saying what the thing is for. */
export function Help({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted">{children}</p>;
}

// ---- Fields that save themselves ----

/** A text field that saves on blur or Enter, and shows that it did. */
export function AutoField({ label, value, onSave, multiline, placeholder, className = "", mono }: {
  label: string; value: string; onSave: (v: string) => Promise<unknown>; multiline?: boolean; placeholder?: string; className?: string; mono?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");
  useEffect(() => setDraft(value), [value]);
  async function commit() {
    if (draft === value) return;
    setState("saving");
    try { await onSave(draft); setState("saved"); setTimeout(() => setState((s) => (s === "saved" ? "idle" : s)), 1500); }
    catch (e) { setState("error"); setError((e as Error).message); }
  }
  const cls = `w-full rounded-md border border-transparent bg-transparent px-2 py-1.5 text-sm hover:border-line focus:border-line focus:bg-card ${mono ? "addr" : ""} ${className}`;
  return (
    <label className="block">
      <span className="flex items-center justify-between px-2 text-xs font-medium text-muted">
        {label}
        <span aria-live="polite" className={state === "error" ? "text-bad" : "text-good"}>{state === "saving" ? "Saving…" : state === "saved" ? "Saved" : state === "error" ? error : ""}</span>
      </span>
      {multiline
        ? <textarea rows={3} aria-label={label} value={draft} placeholder={placeholder} onChange={(e) => setDraft(e.target.value)} onBlur={commit} className={`${cls} resize-y`} />
        : <input aria-label={label} value={draft} placeholder={placeholder} onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} className={cls} />}
    </label>
  );
}

// ---- A small dropdown menu ----

export function Menu({ label, children, align = "right", className = "", buttonClass, ariaLabel }: { label: ReactNode; children: (close: () => void) => ReactNode; align?: "left" | "right"; className?: string; buttonClass?: string; ariaLabel?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);
  return (
    <div ref={ref} className={`relative ${className}`}>
      <button type="button" aria-haspopup="menu" aria-label={ariaLabel} aria-expanded={open} onClick={() => setOpen(!open)}
        className={buttonClass ?? "inline-flex min-h-9 items-center gap-1 rounded-md border border-line bg-card px-3 text-sm font-medium hover:bg-wash"}>{label}</button>
      {open && (
        <div role="menu" className={`absolute z-30 mt-1 min-w-48 rounded-lg border border-line bg-card p-1 text-sm shadow-lg ${align === "right" ? "right-0" : "left-0"}`}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export const menuItem = "block w-full rounded px-2.5 py-1.5 text-left hover:bg-wash disabled:opacity-50";
