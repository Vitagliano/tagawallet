"use client";

import { useEffect, useId, useRef, useState } from "react";
import { FadeText, hit, Icon, press } from "./ui";
import type { Option } from "./select-menu";

/** One thing you can filter by, with any number of values picked (they match any of them). */
export type FilterField = { key: string; label: string; plural: string; options: Option[]; values: string[]; onChange: (v: string[]) => void };

const SURFACE = "rounded-xl bg-card p-1 text-sm text-ink shadow-[0_8px_30px_-6px_rgb(0_0_0/0.18),0_0_0_1px_rgb(0_0_0/0.04)]";

/** A popover that grows out of its trigger, fades out on close, and closes on outside click or Esc. */
function Popover({ open, onClose, align = "left", trigger, children, className = "w-64" }: {
  open: boolean; onClose: () => void; align?: "left" | "right"; trigger: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) onClose(); };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open, onClose]);
  return (
    <div ref={root} className="relative" onKeyDown={(e) => { if (e.key === "Escape" && open) { e.stopPropagation(); onClose(); } }}>
      {trigger}
      <div aria-hidden={!open}
        className={`absolute z-40 mt-1.5 ${SURFACE} ${className} transition-[opacity,scale,visibility] ${align === "right" ? "right-0 origin-top-right" : "left-0 origin-top-left"} ${open ? "visible scale-100 opacity-100 duration-150 ease-out" : "pointer-events-none invisible scale-95 opacity-0 duration-100 ease-in"}`}>
        {open && children}
      </div>
    </div>
  );
}

/** Search (for long lists) plus checkbox rows; Enter or Space toggles, Backspace on an empty search goes back. */
function OptionList({ field, onBack }: { field: FilterField; onBack?: () => void }) {
  const [q, setQ] = useState(""), [index, setIndex] = useState(0);
  const list = useRef<HTMLUListElement>(null), search = useRef<HTMLInputElement>(null);
  const id = useId();
  const withSearch = field.options.length > 6;
  const needle = q.trim().toLowerCase();
  const shown = needle ? field.options.filter((o) => o.label.toLowerCase().includes(needle)) : field.options;
  const on = new Set(field.values);
  const toggle = (v: string) => field.onChange(on.has(v) ? field.values.filter((x) => x !== v) : [...field.values, v]);
  useEffect(() => { (withSearch ? search.current : list.current)?.focus(); }, [withSearch]);
  useEffect(() => { list.current?.querySelector<HTMLElement>(`[data-i="${index}"]`)?.scrollIntoView({ block: "nearest" }); }, [index]);
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setIndex((i) => Math.min(i + 1, shown.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setIndex((i) => Math.max(i - 1, 0)); }
    if ((e.key === "Enter" || (e.key === " " && !withSearch)) && shown[index]) { e.preventDefault(); toggle(shown[index]!.value); }
    if (e.key === "Backspace" && !q && onBack) { e.preventDefault(); onBack(); }
  };
  return (
    <div onKeyDown={onKey}>
      <div className="flex items-center gap-1 px-0.5 pb-1">
        {onBack && (
          <button type="button" onClick={onBack} aria-label="Back to filters" className={`grid size-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-wash hover:text-ink ${press}`}>
            <Icon name="chevronLeft" />
          </button>
        )}
        {withSearch ? (
          <label className="min-w-0 flex-1">
            <span className="sr-only">Find {field.plural.toLowerCase()}</span>
            <input ref={search} value={q} onChange={(e) => { setQ(e.target.value); setIndex(0); }} placeholder={`Find ${field.plural.toLowerCase()}`}
              className="h-9 w-full rounded-lg bg-wash px-2.5 text-sm outline-none placeholder:text-muted" />
          </label>
        ) : <span className="flex-1 px-1.5 text-xs font-medium text-muted">{field.label} is any of</span>}
        <button type="button" disabled={!field.values.length} onClick={() => field.onChange([])}
          className={`h-8 shrink-0 rounded-lg px-2 text-xs text-muted hover:bg-wash hover:text-ink disabled:invisible ${press}`}>Clear</button>
      </div>
      <ul ref={list} id={id} role="listbox" aria-multiselectable aria-label={field.plural} tabIndex={-1} className="scroll-fade-y max-h-64 overflow-y-auto py-1 outline-none">
        {shown.map((o, i) => (
          <li key={o.value} data-i={i} role="option" aria-selected={on.has(o.value)} onMouseEnter={() => setIndex(i)} onClick={() => toggle(o.value)}
            className={`flex min-h-9 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 ${i === index ? "bg-wash" : ""}`}>
            <span aria-hidden className={`grid size-4 shrink-0 place-items-center rounded border transition-colors duration-150 ${on.has(o.value) ? "border-ink bg-ink text-paper" : "border-line bg-card"}`}>
              {on.has(o.value) && <Icon name="check" className="size-3" strokeWidth={2} />}
            </span>
            {o.dot && <span aria-hidden className={`size-2 shrink-0 rounded-full ${o.dot}`} />}
            {o.icon}
            <FadeText className="min-w-0 flex-1">{o.label}</FadeText>
            {o.hint && <span className="shrink-0 text-xs tabular-nums text-muted">{o.hint}</span>}
          </li>
        ))}
        {!shown.length && <li className="px-2.5 py-2 text-xs text-muted">No matches</li>}
      </ul>
    </div>
  );
}

/**
 * One filter as a dropdown that's always on the toolbar. Its text never changes; how many values are
 * picked shows in a badge pinned to the corner, so choosing never shifts the controls around it.
 */
function FilterSelect({ field }: { field: FilterField }) {
  const [open, setOpen] = useState(false);
  const names = field.options.filter((o) => field.values.includes(o.value)).map((o) => o.label).join(", ");
  const n = field.values.length;
  return (
    <Popover open={open} onClose={() => setOpen(false)} trigger={
      <button type="button" aria-haspopup="listbox" aria-expanded={open} aria-label={`${field.label}: ${names || "any"}`} title={names || undefined}
        onClick={() => setOpen((o) => !o)}
        className={`${press} ${hit} inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium ${n ? "bg-ink text-paper" : "bg-card text-muted hover:text-ink"}`}>
        {field.label}
        <Icon name="chevronDown" className={`size-3.5 opacity-70 transition-transform duration-150 ease-out ${open ? "rotate-180" : ""}`} />
        {n > 0 && <span aria-hidden className="absolute -top-1.5 -right-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-card px-1 text-[10px] font-semibold text-ink tabular-nums ring-2 ring-paper">{n}</span>}
      </button>
    }>
      <OptionList field={field} />
    </Popover>
  );
}

/**
 * The filters, out on the toolbar: one dropdown each, then "Clear" (it always keeps its space,
 * so it appearing never moves anything).
 */
export function FilterBar({ fields, onClearAll }: { fields: FilterField[]; onClearAll: () => void }) {
  const any = fields.some((f) => f.values.length > 0);
  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
      {fields.map((f) => <FilterSelect key={f.key} field={f} />)}
      <button type="button" aria-hidden={!any} tabIndex={any ? 0 : -1} onClick={onClearAll}
        className={`h-8 px-1.5 text-xs text-muted hover:text-ink hover:underline ${press} ${hit} ${any ? "" : "invisible"}`}>Clear</button>
    </div>
  );
}
