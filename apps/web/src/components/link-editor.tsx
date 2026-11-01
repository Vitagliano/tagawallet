"use client";

import { LINK_TYPES, LINK_TYPE_LABELS, LINK_STATUSES } from "@tagawallet/shared";
import { Button, Input, Select } from "./ui";

export interface LinkRow { type: string; url: string; label?: string; status?: string }

export function LinkEditor({ value, onChange }: { value: LinkRow[]; onChange: (v: LinkRow[]) => void }) {
  const update = (i: number, patch: Partial<LinkRow>) => onChange(value.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  return (
    <div className="space-y-2">
      {value.map((l, i) => (
        <div key={i} className="grid grid-cols-2 gap-2 rounded-md border border-line p-2 sm:grid-cols-[7rem_1fr]">
          <Select aria-label="Link type" value={l.type} onChange={(e) => update(i, { type: e.target.value })}>
            {LINK_TYPES.map((t) => <option key={t} value={t}>{LINK_TYPE_LABELS[t]}</option>)}
          </Select>
          <Input aria-label="URL or handle" placeholder={l.type === "ens" ? "name.eth" : "URL or @handle"} value={l.url} onChange={(e) => update(i, { url: e.target.value })} />
          <Input aria-label="Label" placeholder="Label, e.g. Official X" value={l.label ?? ""} onChange={(e) => update(i, { label: e.target.value })} className="col-span-2 sm:col-span-1" />
          <div className="col-span-2 flex gap-2 sm:col-span-1">
            <Select aria-label="Link kind" value={l.status ?? "source"} onChange={(e) => update(i, { status: e.target.value })}>
              {LINK_STATUSES.map((s) => <option key={s} value={s}>{s[0]!.toUpperCase() + s.slice(1)}</option>)}
            </Select>
            <Button variant="ghost" aria-label="Remove link" onClick={() => onChange(value.filter((_, j) => j !== i))}>✕</Button>
          </div>
        </div>
      ))}
      <Button onClick={() => onChange([...value, { type: "x", url: "", label: "", status: "official" }])}>+ Add link</Button>
    </div>
  );
}

export const parseTags = (s: string) => s.split(",").map((t) => t.trim()).filter(Boolean);
