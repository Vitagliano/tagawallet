"use client";

import { LINK_TYPE_LABELS, type LinkType } from "@tagawallet/shared";
import { Button, Input } from "./ui";

export interface LinkRow { type: string; url: string; label?: string; status?: string }

const HOSTS: [RegExp, LinkType][] = [
  [/^(www\.)?(x|twitter)\.com$/, "x"], [/^(www\.)?(t\.me|telegram\.me)$/, "telegram"], [/^(www\.)?(discord\.gg|discord\.com)$/, "discord"],
  [/^(www\.)?github\.com$/, "github"], [/^([a-z]+\.)?linkedin\.com$/, "linkedin"], [/^(www\.|m\.)?(youtube\.com|youtu\.be)$/, "youtube"],
];

/** Works out the link type from what was typed, so nobody has to pick one. */
export function detectLinkType(value: string): LinkType {
  const v = value.trim();
  if (/^@?[A-Za-z0-9_]{1,15}$/.test(v)) return "x";
  if (/^([a-z0-9-]+\.)+eth$/i.test(v) || /ens\.domains/i.test(v)) return "ens";
  try {
    const host = new URL(/^[a-z]+:\/\//i.test(v) ? v : `https://${v}`).hostname.toLowerCase();
    return HOSTS.find(([re]) => re.test(host))?.[1] ?? "website";
  } catch {
    return "website";
  }
}

export function LinkEditor({ value, onChange, onCommit, defaultStatus = "official" }: { value: LinkRow[]; onChange: (v: LinkRow[]) => void; onCommit?: (v: LinkRow[]) => void; defaultStatus?: string }) {
  const update = (i: number, url: string) => onChange(value.map((l, j) => (j === i ? { ...l, url, type: url.trim() ? detectLinkType(url) : l.type } : l)));
  return (
    <div className="space-y-2">
      {value.map((l, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-20 shrink-0 text-xs font-medium text-muted">{LINK_TYPE_LABELS[l.type as LinkType] ?? "Link"}</span>
          <Input aria-label="URL or handle" placeholder="@handle, website or name.eth" value={l.url} onChange={(e) => update(i, e.target.value)} onBlur={() => onCommit?.(value)} />
          <Button variant="ghost" aria-label="Remove link" onClick={() => { const next = value.filter((_, j) => j !== i); onChange(next); onCommit?.(next); }}>✕</Button>
        </div>
      ))}
      <Button variant="ghost" onClick={() => onChange([...value, { type: "x", url: "", label: "", status: defaultStatus }])}>+ Add link</Button>
    </div>
  );
}

export const parseTags = (s: string) => s.split(",").map((t) => t.trim()).filter(Boolean);
