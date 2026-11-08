"use client";

import { useEffect, useId, useRef, useState } from "react";
import { FadeText, hit, Icon, press, type IconName } from "./ui";

export type Option = { value: string; label: string; hint?: string; dot?: string; icon?: React.ReactNode };

/**
 * A dropdown that looks like the chips around it, instead of a native select.
 * It grows out of its trigger (ease-out, from 95%), fades out on close, and stays mounted
 * so CSS transitions can be interrupted. Long lists get a search box and faded scroll edges.
 */
export function SelectMenu({ label, value, options, onChange, allLabel, align = "left", searchable, buttonClass, ariaLabel, icon, valueClass = "" }: {
  label: string; value: string; options: Option[]; onChange: (v: string) => void;
  /** Adds a first "any" option with this text, and shows the button as inactive when it's picked. */
  allLabel?: string; align?: "left" | "right"; searchable?: boolean; buttonClass?: string; ariaLabel?: string;
  /** Compact trigger: this icon stands in for the label, followed by the current value. */
  icon?: IconName;
  /** Classes for the visible value text, e.g. to hide it in a narrow container and keep only the icon. */
  valueClass?: string;
}) {
  const [open, setOpen] = useState(false), [q, setQ] = useState(""), [index, setIndex] = useState(0);
  const root = useRef<HTMLDivElement>(null), list = useRef<HTMLUListElement>(null), search = useRef<HTMLInputElement>(null);
  const id = useId();
  const all: Option[] = allLabel ? [{ value: "", label: allLabel }, ...options] : options;
  const needle = q.trim().toLowerCase();
  const shown = needle ? all.filter((o) => o.label.toLowerCase().includes(needle)) : all;
  const current = all.find((o) => o.value === value);
  const active = !!value && !!allLabel;
  const withSearch = searchable ?? options.length > 8;

  useEffect(() => {
    if (!open) { setQ(""); return; }
    setIndex(Math.max(0, all.findIndex((o) => o.value === value)));
    (withSearch ? search.current : list.current)?.focus();
    const onDown = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (open) list.current?.querySelector<HTMLElement>(`[data-i="${index}"]`)?.scrollIntoView({ block: "nearest" }); }, [index, open]);

  const choose = (o: Option) => { onChange(o.value); setOpen(false); };
  const onKey = (e: React.KeyboardEvent) => {
    if (!open) return;
    if (e.key === "Escape") { e.stopPropagation(); setOpen(false); }
    if (e.key === "ArrowDown") { e.preventDefault(); setIndex((i) => Math.min(i + 1, shown.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setIndex((i) => Math.max(i - 1, 0)); }
    if (e.key === "Enter" && shown[index]) { e.preventDefault(); choose(shown[index]!); }
  };

  return (
    <div ref={root} className="relative" onKeyDown={onKey}>
      <button type="button" aria-haspopup="listbox" aria-expanded={open} aria-controls={id} aria-label={ariaLabel ?? `${label}: ${current?.label ?? allLabel ?? ""}`}
        onClick={() => setOpen((o) => !o)}
        className={`${press} ${hit} ${buttonClass ?? `inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium ${active ? "bg-ink text-paper" : "bg-card text-muted hover:text-ink"}`}`}>
        {current?.dot && <span aria-hidden className={`size-2 rounded-full ${current.dot}`} />}
        {icon && <Icon name={icon} className="size-3.5" />}
        <span className={`truncate ${valueClass}`}>{icon ? current?.label : allLabel ? (active ? current?.label : label) : `${label}: ${current?.label ?? ""}`}</span>
        <Icon name="chevronDown" className={`size-3.5 opacity-70 transition-transform duration-150 ease-out ${open ? "rotate-180" : ""}`} />
      </button>
      <div aria-hidden={!open}
        className={`absolute z-40 mt-1.5 w-60 rounded-xl bg-card p-1 text-sm text-ink shadow-[0_8px_30px_-6px_rgb(0_0_0/0.18),0_0_0_1px_rgb(0_0_0/0.04)] transition-[opacity,scale,visibility] ${align === "right" ? "right-0 origin-top-right" : "left-0 origin-top-left"} ${open ? "visible scale-100 opacity-100 duration-150 ease-out" : "pointer-events-none invisible scale-95 opacity-0 duration-100 ease-in"}`}>
        {withSearch && (
          <label className="mb-1 block">
            <span className="sr-only">Find {label.toLowerCase()}</span>
            <input ref={search} value={q} onChange={(e) => { setQ(e.target.value); setIndex(0); }} placeholder={`Find ${label.toLowerCase()}`} tabIndex={open ? 0 : -1}
              className="h-9 w-full rounded-lg bg-wash px-2.5 text-sm outline-none placeholder:text-muted" />
          </label>
        )}
        <ul ref={list} id={id} role="listbox" aria-label={label} tabIndex={-1} className="scroll-fade-y max-h-64 overflow-y-auto py-1 outline-none">
          {shown.map((o, i) => (
            <li key={o.value || "_all"} data-i={i} role="option" aria-selected={o.value === value}
              onMouseEnter={() => setIndex(i)} onClick={() => choose(o)}
              className={`flex min-h-9 cursor-pointer items-center gap-2 rounded-lg px-2.5 ${i === index ? "bg-wash" : ""}`}>
              {o.dot ? <span aria-hidden className={`size-2 shrink-0 rounded-full ${o.dot}`} /> : null}
              {o.icon}
              <FadeText className="min-w-0 flex-1">{o.label}</FadeText>
              {o.hint && <span className="shrink-0 text-xs tabular-nums text-muted">{o.hint}</span>}
              <Icon name="check" className={`size-3.5 ${o.value === value ? "" : "invisible"}`} />
            </li>
          ))}
          {!shown.length && <li className="px-2.5 py-2 text-xs text-muted">No matches</li>}
        </ul>
      </div>
    </div>
  );
}

