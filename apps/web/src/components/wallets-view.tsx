"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { addressError, CHAIN_IDS, CHAINS, parsePastedAddress } from "@tagawallet/shared";
import { api, fetcher } from "@/lib/client";
import { Address, Button, ChainName, Empty, ErrorNote, Select } from "./ui";
import { LabelChips, Menu, menuItem, QUICK_STATUSES, useToast } from "./kit";
import { refreshAll, useOpenWallet } from "./wallet-drawer";
import { addToCollection, collectionsOf, CollectionPicker, KindIcon, removeFromCollection, resolveCollection, useCollections, useCreate, type Kind } from "./collections";
import { ImportDialog } from "./import-dialog";

type Filters = { status: string; tag: string; chain: string; within: string; unfiled: boolean };
const NO_FILTERS: Filters = { status: "", tag: "", chain: "", within: "", unfiled: false };
const isUnfiledParam = (p: URLSearchParams) => p.get("unfiled") === "1" || p.get("unfiled") === "true"
  || p.get("unlinked") === "1" || p.get("unlinked") === "true";

/**
 * Wallets, everywhere they're shown: the wallet book and inside a shared list.
 * Search only finds. Adding is always the "Add wallet" button, so the two never get confused.
 */
export function WalletsView({ scope, canEdit = true, emptyHint, placeholder, above }: {
  scope?: { kind: Kind; id: string; name: string }; canEdit?: boolean; emptyHint?: React.ReactNode;
  placeholder?: string;
  /** Rendered under the search bar with the current search text, so a page can show its own matches above the wallets. */
  above?: (search: string) => React.ReactNode;
}) {
  const params = useSearchParams();
  const openWallet = useOpenWallet();
  const { mutate } = useSWRConfig();
  const { undoable, toast } = useToast();
  const { addWallet } = useCreate();
  const { all: collections } = useCollections();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [debounced, setDebounced] = useState(q);
  const [filters, setFilters] = useState<Filters>(() => ({
    ...NO_FILTERS,
    unfiled: isUnfiledParam(params),
  }));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  useEffect(() => { const t = setTimeout(() => setDebounced(q), 150); return () => clearTimeout(t); }, [q]);
  useEffect(() => { const v = params.get("q"); if (v) setQ(v); }, [params]);
  useEffect(() => {
    if (isUnfiledParam(params)) setFilters((f) => (f.unfiled ? f : { ...f, unfiled: true }));
  }, [params]);
  // Old links that used the bar to add an address now open the Add wallet dialog.
  useEffect(() => { const a = params.get("add"); if (a) addWallet({ address: a }); }, [params]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: tagData } = useSWR<{ tags: string[] }>("/api/tags", fetcher);

  const parsed = parsePastedAddress(q);
  const isAddress = !!parsed && parsed.kind !== "ens" && parsed.kind !== "sns";
  const badAddress = !isAddress && /^0x[0-9a-fA-F]{40}$/.test(q.trim()) ? addressError(q.trim(), "ethereum") : null;
  const query = new URLSearchParams({ shape: "page", limit: "200" });
  const term = isAddress ? parsed!.normalized : debounced.trim();
  if (term) query.set("q", term);
  const within = scope ?? (filters.within ? { kind: filters.within.split(":")[0] as Kind, id: filters.within.split(":")[1]! } : null);
  if (within) query.set(within.kind === "list" ? "list" : "entity", within.id);
  for (const k of ["status", "tag", "chain"] as const) if (filters[k]) query.set(k, filters[k]);
  if (filters.unfiled && !scope) query.set("unfiled", "1");
  const { data, isLoading } = useSWR<{ wallets: any[]; more: boolean }>(`/api/wallets?${query}`, fetcher, { keepPreviousData: true });

  const wallets = useMemo(() => (data?.wallets ?? []).filter((w) => !hidden.has(w.id)), [data, hidden]);
  const exact = isAddress ? wallets.find((w) => w.normalizedAddress === parsed!.normalized) : null;
  const customLabels = tagData?.tags ?? [];
  const filtering = Object.values(filters).some(Boolean) || !!term;
  const chosen = wallets.filter((w) => selected.has(w.id));
  const allOn = wallets.length > 0 && wallets.every((w) => selected.has(w.id));
  const set = (patch: Partial<Filters>) => { setFilters((f) => ({ ...f, ...patch })); setSelected(new Set()); };
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const addHere = (address?: string) => addWallet({ address, into: scope ? { ...scope } : undefined });

  async function bulk(label: string, fn: (w: any) => Promise<unknown>) {
    const results = await Promise.allSettled(chosen.map(fn));
    const failed = results.filter((r) => r.status === "rejected").length;
    await refreshAll(mutate);
    setSelected(new Set());
    toast(failed ? `${label}, but ${failed} couldn't be changed.` : `${label}.`);
  }
  /** One request for the whole selection. The server checks access per wallet and says what it couldn't change. */
  async function bulkOp(label: string, body: Record<string, unknown>) {
    try {
      const r = await api<{ changed: number; failed: { id: string }[] }>("/api/wallets/bulk", { body: { ids: chosen.map((w) => w.id), ...body } });
      toast(r.failed.length ? `${label}, but ${r.failed.length} couldn't be changed.` : `${label}.`);
    } catch (e) { toast((e as Error).message); }
    await refreshAll(mutate);
    setSelected(new Set());
  }
  const chosenTags = [...new Set(chosen.flatMap((w) => w.tags ?? []))].sort();
  const otherLists = collections.filter((c) => c.kind === "list" && c.canEdit && c.id !== scope?.id);
  const entities = collections.filter((c) => c.kind !== "list" && c.canEdit && c.id !== scope?.id);
  const exportQuery = (format: string) => { const e = new URLSearchParams(query); e.delete("shape"); e.delete("limit"); e.set("format", format); return `/api/wallets/export?${e}`; };

  function bulkHide(label: string, fn: (w: any) => Promise<unknown>) {
    const ids = chosen.map((w) => w.id), targets = chosen;
    setHidden((h) => new Set([...h, ...ids]));
    setSelected(new Set());
    undoable(label, async () => { await Promise.allSettled(targets.map(fn)); await refreshAll(mutate); }, () => setHidden((h) => new Set([...h].filter((x) => !ids.includes(x)))));
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <span aria-hidden className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted">⌕</span>
          <input
            type="search" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search wallets"
            placeholder={placeholder ?? (scope ? `Search ${scope.name}` : "Search by name, label, note or address")}
            className="h-10 w-full rounded-xl border border-transparent bg-card pr-3 pl-9 text-sm placeholder:text-muted/70 focus:border-accent"
          />
        </div>
        {canEdit && <Button variant="primary" className="h-10 shrink-0 rounded-xl" onClick={() => addHere()}>Add wallet</Button>}
        <Menu label="⋯" ariaLabel="Import or export" buttonClass="h-10 rounded-xl bg-card px-3 text-muted hover:text-ink">
          {(close) => (
            <>
              {canEdit && <button className={menuItem} onClick={() => { close(); setImporting(true); }}>Import CSV or JSON</button>}
              <a className={menuItem} href={exportQuery("csv")} onClick={close}>Export {filtering ? "these" : "all"} as CSV</a>
              <a className={menuItem} href={exportQuery("json")} onClick={close}>Export {filtering ? "these" : "all"} as JSON</a>
            </>
          )}
        </Menu>
      </div>
      {importing && <ImportDialog scope={scope} onClose={() => setImporting(false)} />}

      {badAddress && <ErrorNote>{badAddress}</ErrorNote>}
      {isAddress && !exact && !isLoading && canEdit && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-card px-4 py-3 text-sm">
          <span><Address value={parsed!.raw} /> isn&apos;t in {scope ? scope.name : "your wallets"} yet.</span>
          <Button variant="primary" onClick={() => { addHere(parsed!.raw); setQ(""); }}>Add it</Button>
        </div>
      )}

      {above?.(isAddress ? "" : debounced.trim())}

      <div className="flex flex-wrap items-center gap-1.5" role="toolbar" aria-label="Filters">
        {QUICK_STATUSES.map((st) => (
          <FilterChip key={st.value} on={filters.status === st.value} onClick={() => set({ status: filters.status === st.value ? "" : st.value, tag: "" })}>
            <span aria-hidden className={`size-2 rounded-full ${st.tone}`} />{st.label}
          </FilterChip>
        ))}
        {customLabels.slice(0, 5).map((t) => (
          <FilterChip key={t} on={filters.tag === t} onClick={() => set({ tag: filters.tag === t ? "" : t, status: "" })}>{t}</FilterChip>
        ))}
        {customLabels.length > 5 && <FilterSelect label="More labels" value={customLabels.slice(0, 5).includes(filters.tag) ? "" : filters.tag} onChange={(tag) => set({ tag, status: "" })} options={customLabels.slice(5).map((t) => [t, t])} />}
        <span className="mx-1 hidden h-5 w-px bg-line sm:block" aria-hidden />
        {!scope && (
          <FilterChip on={filters.unfiled} onClick={() => set({ unfiled: !filters.unfiled, within: "" })}>
            Unfiled
          </FilterChip>
        )}
        {!scope && <FilterSelect label="List" value={filters.within} onChange={(v) => set({ within: v, unfiled: false })} options={collections.map((c) => [`${c.kind}:${c.id}`, c.name])} />}
        <FilterSelect label="Chain" value={filters.chain} onChange={(chain) => set({ chain })} options={CHAIN_IDS.map((c) => [c, CHAINS[c].name])} />
        {Object.values(filters).some(Boolean) && <button className="px-2 text-xs text-muted hover:text-ink hover:underline" onClick={() => set(NO_FILTERS)}>Clear filters</button>}
      </div>

      {chosen.length > 0 && (
        <div className="sticky top-26 z-20 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-ink px-3 py-2 text-sm text-paper shadow-lg md:top-17">
          <span className="mr-1 font-medium">{chosen.length} selected</span>
          <Menu label="Add to list" buttonClass="rounded-md px-2.5 py-1 hover:bg-paper/15" align="left">
            {(close) => (
              <div className="w-72 p-1.5 text-ink">
                <CollectionPicker autoFocus exclude={scope ? [scope.id] : []} onSelect={async (c) => {
                  close();
                  const target = await resolveCollection(c);
                  await bulk(`Added to ${target.name}`, (w) => addToCollection(target, w.id));
                }} />
              </div>
            )}
          </Menu>
          <Menu label="Label" buttonClass="rounded-md px-2.5 py-1 hover:bg-paper/15" align="left">
            {(close) => (
              <div className="text-ink">
                {QUICK_STATUSES.map((st) => (
                  <button key={st.value} className={`${menuItem} flex items-center gap-2`} onClick={() => { close(); void bulkOp(`Labeled ${st.label.toLowerCase()}`, { op: "setStatus", status: st.value }); }}>
                    <span aria-hidden className={`size-2 rounded-full ${st.tone}`} />{st.label}
                  </button>
                ))}
                <form className="mt-1 space-y-2 border-t border-line p-1.5 pt-2" onSubmit={(e) => {
                  e.preventDefault();
                  const tag = String(new FormData(e.currentTarget).get("label") ?? "").trim().toLowerCase();
                  if (!tag) return;
                  close();
                  void bulkOp(`Labeled “${tag}”`, { op: "addTag", tag });
                }}>
                  <input name="label" aria-label="Your own label" list="bulk-labels" placeholder="Or your own label" className="w-full rounded-md border border-line bg-card px-2 py-1.5 text-sm" />
                  <datalist id="bulk-labels">{customLabels.map((t) => <option key={t} value={t} />)}</datalist>
                  <Button type="submit" variant="primary" className="w-full">Add label</Button>
                </form>
                {chosenTags.length > 0 && (
                  <div className="mt-1 border-t border-line p-1.5 pt-2">
                    <p className="px-1 pb-1 text-xs text-muted">Remove a label</p>
                    {chosenTags.map((t) => (
                      <button key={t} className={menuItem} onClick={() => { close(); void bulkOp(`Removed “${t}”`, { op: "removeTag", tag: t }); }}>✕ {t}</button>
                    ))}
                    <button className={menuItem} onClick={() => { close(); void bulkOp("Cleared the status", { op: "setStatus", status: "none" }); }}>✕ Clear status</button>
                  </div>
                )}
              </div>
            )}
          </Menu>
          {scope?.kind === "list" && canEdit && otherLists.length > 0 && (
            <Menu label="Move to" buttonClass="rounded-md px-2.5 py-1 hover:bg-paper/15" align="left">
              {(close) => (
                <div className="max-h-72 w-60 overflow-auto text-ink">
                  {otherLists.map((l) => (
                    <button key={l.id} className={menuItem} onClick={() => { close(); void bulkOp(`Moved to ${l.name}`, { op: "move", fromListId: scope.id, toListId: l.id }); }}>{l.name}</button>
                  ))}
                </div>
              )}
            </Menu>
          )}
          {entities.length > 0 && chosen.every((w) => w.own) && (
            <Menu label="Link to" buttonClass="rounded-md px-2.5 py-1 hover:bg-paper/15" align="left">
              {(close) => (
                <div className="max-h-72 w-60 overflow-auto text-ink">
                  {entities.map((e) => (
                    <button key={e.id} className={`${menuItem} flex items-center gap-2`} onClick={() => { close(); void bulkOp(`Linked to ${e.name}`, { op: "linkEntity", entityId: e.id }); }}>
                      <KindIcon kind={e.kind} className="size-3.5" />{e.name}
                    </button>
                  ))}
                </div>
              )}
            </Menu>
          )}
          <Menu label="Note" buttonClass="rounded-md px-2.5 py-1 hover:bg-paper/15" align="left">
            {(close) => (
              <form className="w-72 space-y-2 p-1.5 text-ink" onSubmit={(e) => {
                e.preventDefault();
                const data = new FormData(e.currentTarget);
                const mode = (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "replace" ? "replace" : "append";
                const text = String(data.get("note") ?? "").trim();
                if (!text && mode === "append") return;
                close();
                void bulkOp(mode === "replace" ? "Replaced notes" : "Added a note", { op: "setNotes", mode, text });
              }}>
                <textarea name="note" aria-label="Note for selected wallets" rows={3} placeholder="Where these came from, why they matter" className="w-full rounded-md border border-line bg-card px-2 py-1.5 text-sm" />
                <div className="flex gap-2">
                  <Button type="submit" value="append" variant="primary" className="flex-1">Add to notes</Button>
                  <Button type="submit" value="replace" className="flex-1">Replace</Button>
                </div>
              </form>
            )}
          </Menu>
          <span className="ml-auto flex items-center gap-1">
            {scope && canEdit && <button className="rounded-md px-2.5 py-1 hover:bg-paper/15" onClick={() => bulkHide(`Removed ${chosen.length} from ${scope.name}`, (w) => removeFromCollection(scope, w.id))}>Remove from {scope.kind === "list" ? "list" : scope.name}</button>}
            {chosen.every((w) => w.own) && <button className="rounded-md px-2.5 py-1 text-[color:var(--bad)] hover:bg-paper/15" onClick={() => bulkHide(`Deleted ${chosen.length} wallet${chosen.length === 1 ? "" : "s"}`, (w) => api(`/api/wallets/${w.id}`, { method: "DELETE" }))}>Delete</button>}
            <button aria-label="Clear selection" className="rounded-md px-2 py-1 hover:bg-paper/15" onClick={() => setSelected(new Set())}>✕</button>
          </span>
        </div>
      )}

      {wallets.length > 0 ? (
        <div className="overflow-hidden rounded-2xl bg-card">
          <div className="flex items-center gap-3 border-b border-line px-4 py-2 text-xs text-muted">
            <input type="checkbox" aria-label="Select all" checked={allOn} onChange={() => setSelected(allOn ? new Set() : new Set(wallets.map((w) => w.id)))} />
            <span className="tabular-nums">{wallets.length}{data?.more ? "+" : ""} wallet{wallets.length === 1 ? "" : "s"}{filtering ? " match" : ""}</span>
          </div>
          <ul className="divide-y divide-line">
            {wallets.map((w) => {
              const where = collectionsOf(w).filter((c) => !scope || c.id !== scope.id);
              return (
                <li key={w.id} className={`flex items-center gap-3 px-4 py-2.5 hover:bg-wash/60 ${selected.has(w.id) ? "bg-wash/80" : ""}`}>
                  <input type="checkbox" aria-label={`Select ${w.displayLabel || w.address}`} checked={selected.has(w.id)} onChange={() => toggle(w.id)} />
                  <button className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1 text-left" onClick={() => openWallet(w.id)}>
                    <span className="min-w-0 flex-1 basis-56">
                      <span className="block truncate font-medium">{w.displayLabel || <span className="text-muted">Unnamed wallet</span>}</span>
                      <span className="flex flex-wrap items-center gap-x-1 text-xs text-muted">
                        <Address value={w.address} /> · <ChainName chain={w.chain} />
                      </span>
                    </span>
                    <LabelChips status={w.status} tags={w.tags} />
                    {where.length > 0 && (
                      <span className="hidden max-w-48 items-center gap-1 truncate text-xs text-muted lg:flex" title={where.map((c) => c.name).join(", ")}>
                        <KindIcon kind={where[0]!.kind} className="size-3.5" /><span className="truncate">{where[0]!.name}</span>{where.length > 1 && <span>+{where.length - 1}</span>}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          {data?.more && <p className="border-t border-line px-4 py-2 text-xs text-muted">Showing the 200 most recent. Search or filter to narrow it down.</p>}
        </div>
      ) : !data ? (
        <div aria-hidden className="h-40 animate-pulse rounded-2xl bg-card" />
      ) : !isAddress && (
        filtering
          ? <Empty title="No matches">Search covers your own wallets and lists shared with you.</Empty>
          : (
            <div className="rounded-2xl bg-card px-6 py-12 text-center">
              <p className="font-medium">{scope ? `Nothing in ${scope.name} yet` : "No wallets yet"}</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted">{emptyHint ?? "Add an address and give it a name you'll recognize. That's all a tag is."}</p>
              {canEdit && <Button variant="primary" className="mt-4" onClick={() => addHere()}>Add wallet</Button>}
            </div>
          )
      )}
    </div>
  );
}

function FilterChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button aria-pressed={on} onClick={onClick}
      className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition ${on ? "bg-ink text-paper" : "bg-card text-muted hover:text-ink"}`}>
      {children}
    </button>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  if (!options.length && !value) return null;
  return (
    <Select aria-label={`Filter by ${label.toLowerCase()}`} value={value} onChange={(e) => onChange(e.target.value)}
      className={`h-8 w-auto rounded-full border-transparent py-0 pr-7 pl-3 text-xs font-medium ${value ? "bg-ink text-paper" : "bg-card text-muted"}`}>
      <option value="">{label}: any</option>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </Select>
  );
}
