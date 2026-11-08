"use client";

import { useMemo, useState } from "react";
import { useSWRConfig } from "swr";
import { api } from "@/lib/client";
import { parseCsv } from "@/lib/csv";
import { Address, Button, ChainName, ErrorNote, Field, Modal, Select, Textarea } from "./ui";
import { useCollections, type Kind } from "./collections";
import { refreshAll } from "./wallet-drawer";

const FIELDS = [
  { key: "address", label: "Address", required: true, guesses: ["address", "wallet", "addr", "account", "public key", "pubkey"] },
  { key: "chain", label: "Chain", guesses: ["chain", "network", "blockchain"] },
  { key: "label", label: "Name", guesses: ["label", "name", "displaylabel", "display name", "title", "alias"] },
  { key: "status", label: "Status", guesses: ["status", "type"] },
  { key: "tags", label: "Labels", guesses: ["tags", "labels", "tag", "categories"] },
  { key: "notes", label: "Notes", guesses: ["notes", "note", "description", "memo", "comment"] },
] as const;
type FieldKey = (typeof FIELDS)[number]["key"];
type Mapping = Partial<Record<FieldKey, string>>;
type Result = {
  imported: number; created: number; existing: number; duplicates: number; errorCount: number; total: number; dryRun: boolean;
  errors: { row: number; message: string }[]; preview: { row: number; address: string; chain: string; label: string; outcome: string }[];
};

const OUTCOME: Record<string, string> = { new: "New", existing: "Already yours", duplicate: "Skipped, duplicate" };

function formatOf(name: string, text: string): "csv" | "json" {
  return name.toLowerCase().endsWith(".json") || /^\s*[[{]/.test(text) ? "json" : "csv";
}

/** Column names in the file, for the mapping step. */
function columnsOf(format: "csv" | "json", text: string): string[] {
  try {
    if (format === "csv") return Object.keys(parseCsv(text.split(/\r?\n/).slice(0, 2).join("\n"))[0] ?? {});
    const parsed = JSON.parse(text);
    const rows = Array.isArray(parsed) ? parsed : parsed?.wallets;
    return Array.isArray(rows) && rows[0] && typeof rows[0] === "object" ? Object.keys(rows[0]) : [];
  } catch { return []; }
}

function guess(columns: string[]): Mapping {
  const m: Mapping = {};
  for (const f of FIELDS) {
    const hit = columns.find((c) => (f.guesses as readonly string[]).includes(c.trim().toLowerCase()));
    if (hit) m[f.key] = hit;
  }
  return m;
}

/**
 * Import from a file or pasted text: map the columns, preview what will happen, then confirm.
 * Inside a list, person or project, wallets land there. Elsewhere you choose, or keep them just in your wallets.
 */
export function ImportDialog({ scope, onClose }: { scope?: { kind: Kind; id: string; name: string }; onClose: () => void }) {
  const { mutate } = useSWRConfig();
  const { all: collections } = useCollections();
  const [text, setText] = useState(""), [name, setName] = useState("");
  const [mapping, setMapping] = useState<Mapping>({});
  const [dest, setDest] = useState(scope ? `${scope.kind}:${scope.id}` : "");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState(""), [busy, setBusy] = useState(false);

  const format = formatOf(name, text);
  const columns = useMemo(() => (text ? columnsOf(format, text) : []), [format, text]);
  const target = dest ? { kind: dest.split(":")[0] as Kind, id: dest.split(":")[1]! } : null;
  const targetName = scope?.name ?? collections.find((c) => target && c.kind === target.kind && c.id === target.id)?.name;

  const load = (content: string, filename = "") => {
    setText(content); setName(filename); setResult(null); setError("");
    setMapping(guess(columnsOf(formatOf(filename, content), content)));
  };

  async function run(dryRun: boolean) {
    setBusy(true); setError("");
    try {
      const body = {
        format, content: text, mapping, dryRun,
        ...(target?.kind === "list" ? { listId: target.id } : target ? { entityId: target.id } : {}),
      };
      const r = await api<Result>("/api/wallets/import", { body });
      setResult(r);
      if (!dryRun) await refreshAll(mutate);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  const done = result && !result.dryRun;
  const ready = !!text.trim() && (!columns.length || !!mapping.address || columns.includes("address"));

  return (
    <Modal open onClose={onClose} title={scope ? `Import into ${scope.name}` : "Import wallets"}>
      {done ? (
        <div className="space-y-3">
          <p role="status" className="rounded-md bg-wash p-3 text-sm">
            Imported {result.imported} wallet{result.imported === 1 ? "" : "s"}{targetName ? ` into ${targetName}` : ""}.
            {result.duplicates > 0 && ` ${result.duplicates} skipped as duplicates.`}
            {result.errorCount > 0 && ` ${result.errorCount} couldn't be read.`}
          </p>
          <Button variant="primary" onClick={onClose}>Done</Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-muted">A CSV or JSON file from a spreadsheet, an explorer or another tool. Only an address column is required.</p>
            <input type="file" accept=".csv,.json,text/csv,application/json" aria-label="File to import" className="block w-full text-sm"
              onChange={async (e) => { const f = e.target.files?.[0]; if (f) load(await f.text(), f.name); }} />
            <Textarea rows={3} aria-label="Or paste CSV or JSON" placeholder={"Or paste here, e.g.\naddress,name\n0x…,Treasury"} className="font-mono text-xs"
              value={name ? "" : text} onChange={(e) => load(e.target.value)} disabled={!!name} />
            {name && <p className="text-xs text-muted">{name} · {format.toUpperCase()} <button className="underline" onClick={() => load("")}>Clear</button></p>}
          </div>

          {columns.length > 0 && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Match the columns</legend>
              <div className="grid grid-cols-2 gap-2">
                {FIELDS.map((f) => (
                  <label key={f.key} className="text-xs text-muted">
                    {f.label}{"required" in f && f.required ? "" : " · optional"}
                    <Select aria-label={`Column for ${f.label}`} value={mapping[f.key] ?? ""} onChange={(e) => { setMapping({ ...mapping, [f.key]: e.target.value || undefined }); setResult(null); }}>
                      <option value="">{"required" in f && f.required ? "Choose a column" : "Not in this file"}</option>
                      {columns.map((c) => <option key={c} value={c}>{c}</option>)}
                    </Select>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {!scope && (
            <Field label="Add them to" hint="Optional. Without one, they're saved to your wallets, private to you.">
              <Select aria-label="Add them to" value={dest} onChange={(e) => { setDest(e.target.value); setResult(null); }}>
                <option value="">Just my wallets</option>
                {collections.filter((c) => c.canEdit).map((c) => <option key={`${c.kind}:${c.id}`} value={`${c.kind}:${c.id}`}>{c.name}{c.kind === "list" ? "" : ` (${c.kind})`}</option>)}
              </Select>
            </Field>
          )}

          {result && (
            <div role="status" aria-label="Import preview" className="space-y-2 rounded-md bg-wash p-3 text-sm">
              <p className="font-medium">
                {result.created} new, {result.existing} already in your wallets{target ? ` (added to ${targetName ?? "it"})` : ""}, {result.duplicates} duplicate{result.duplicates === 1 ? "" : "s"}, {result.errorCount} unreadable.
              </p>
              {result.preview.length > 0 && (
                <ul className="max-h-40 divide-y divide-line overflow-auto text-xs">
                  {result.preview.map((p) => (
                    <li key={p.row} className="flex items-center justify-between gap-2 py-1">
                      <span className="min-w-0 truncate">{p.label || <span className="text-muted">Unnamed</span>} · <Address value={p.address} /> · <ChainName chain={p.chain} /></span>
                      <span className="shrink-0 text-muted">{OUTCOME[p.outcome]}</span>
                    </li>
                  ))}
                </ul>
              )}
              {result.errors.length > 0 && (
                <ul className="max-h-24 overflow-auto text-xs text-bad">{result.errors.map((e) => <li key={e.row}>Row {e.row}: {e.message}</li>)}</ul>
              )}
            </div>
          )}

          <ErrorNote>{error}</ErrorNote>
          <div className="flex gap-2">
            {result?.dryRun
              ? <Button variant="primary" disabled={busy || !result.imported} onClick={() => run(false)}>{busy ? "Importing…" : `Import ${result.imported} wallet${result.imported === 1 ? "" : "s"}`}</Button>
              : <Button variant="primary" disabled={busy || !ready} onClick={() => run(true)}>{busy ? "Checking…" : "Preview"}</Button>}
            <Button onClick={onClose}>Cancel</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
