"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import useSWR, { preload, useSWRConfig } from "swr";
import { CHAIN_IDS, CHAINS, parsePastedAddress, truncateAddress } from "@tagawallet/shared";
import { api, fetcher } from "@/lib/client";
import { Button } from "@/components/ui";
import { LabelChips, Menu, menuItem, QUICK_STATUSES, useToast } from "@/components/kit";
import { addToCollection, collectionsOf, CollectionPicker, KindIcon, removeFromCollection, resolveCollection, useCreate, type Kind } from "@/components/collections";
import { refreshAll } from "@/components/wallet-drawer";
import { ImportDialog } from "@/components/import-dialog";
import { ago } from "../shared";
import { SelectMenu } from "./select-menu";
import { FilterBar, type FilterField } from "./filter-bar";
import { ChainIcon } from "./chain-icon";
import { ContentSurface, type ContentTransition } from "./content-surface";
import { Bone, FadeText, hit, Icon, IconButton, press } from "./ui";
import { ClaimHint } from "@/components/features/address-intel";
import { useRowHints } from "./address";

export type Scope = { kind: Kind; id: string; name: string };
type Row = any;
type Page = { wallets: Row[]; total: number; offset: number; limit: number };

const SORTS = [
  { value: "updated", label: "Last updated" },
  { value: "created", label: "Last added" },
  { value: "name", label: "Name A–Z" },
];
const SIZES = [25, 50, 100];

/**
 * The wallet table for v3.2: one search (owned by the page), compact filter menus,
 * real pagination with a total, and rows that open the floating panel.
 */
export function WalletTable({ scope, unfiled, q, canEdit, openId, onOpen, onRows, compact, onNewAddress, renderExpanded, prefetch, pageView, transition, renderNewAddress, rowHints }: {
  scope?: Scope; unfiled?: boolean; q: string; canEdit: boolean;
  /** Narrow mode beside the open panel: only the columns you need to pick the next wallet. */
  compact?: boolean;
  /** Told the pasted address once the search shows it isn't saved yet (null otherwise), so the page's Add wallet can add it. */
  onNewAddress?: (address: string | null) => void;
  /** Inline mode: the open wallet's details render in a row right under it. */
  renderExpanded?: (id: string) => React.ReactNode;
  /** Load a wallet's details on hover, so opening it shows them at once instead of a skeleton. */
  prefetch?: boolean;
  /**
   * Page modes: a wallet shown in this table's place. Its bar replaces the filter row (no animation) and its
   * content replaces the table inside the same content area, which is the only thing that animates.
   */
  pageView?: { key: string; bar: React.ReactNode; content: React.ReactNode } | null;
  transition?: ContentTransition;
  /** How a pasted, unsaved address is shown, above the filters. */
  renderNewAddress?: (address: string) => React.ReactNode;
  /** Show under each wallet who else claims its address (public profiles, shared lists). */
  rowHints?: boolean;
  openId: string | null; onOpen: (id: string) => void; onRows: (rows: { id: string; name: string }[]) => void;
}) {
  const { mutate } = useSWRConfig();
  const { toast, undoable } = useToast();
  const { addWallet } = useCreate();
  const [statuses, setStatuses] = useState<string[]>([]), [tags, setTags] = useState<string[]>([]), [chains, setChains] = useState<string[]>([]), [sort, setSort] = useState("updated");
  const [size, setSize] = useState(25), [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Inline: keep the row that's closing rendered for a moment so it can fold away instead of vanishing.
  const [closing, setClosing] = useState<string | null>(null);
  const lastOpen = useRef<string | null>(openId);
  useEffect(() => {
    const prev = lastOpen.current;
    lastOpen.current = openId;
    if (!renderExpanded || !prev || prev === openId) return;
    setClosing(prev);
    const t = setTimeout(() => setClosing((c) => (c === prev ? null : c)), 280);
    return () => clearTimeout(t);
  }, [openId]); // eslint-disable-line react-hooks/exhaustive-deps
  const cols = renderExpanded ? 6 : 5;
  useEffect(() => { if (!selected.size) setConfirmDelete(false); }, [selected.size]);
  const [debounced, setDebounced] = useState(q);
  useEffect(() => { const t = setTimeout(() => setDebounced(q), 150); return () => clearTimeout(t); }, [q]);
  // Any change to what's being asked for starts again from the first page.
  useEffect(() => { setPage(0); setSelected(new Set()); }, [debounced, statuses.join(), tags.join(), chains.join(), sort, size, scope?.id, unfiled]); // eslint-disable-line react-hooks/exhaustive-deps

  const parsed = parsePastedAddress(q);
  const isAddress = !!parsed && parsed.kind !== "ens" && parsed.kind !== "sns";
  const term = isAddress ? parsed!.normalized : debounced.trim();

  const params = new URLSearchParams({ offset: String(page * size), limit: String(size), sort });
  if (term) params.set("q", term);
  if (scope) params.set(scope.kind === "list" ? "list" : "entity", scope.id);
  if (unfiled && !scope) params.set("unfiled", "1");
  if (statuses.length) params.set("status", statuses.join(","));
  // Several labels or chains match any of them.
  if (tags.length) params.set("tag", tags.join(","));
  if (chains.length) params.set("chain", chains.join(","));
  const { data, isLoading } = useSWR<Page>(`/api/wallets?${params}`, fetcher, { keepPreviousData: true });
  const { data: tagData } = useSWR<{ tags: string[] }>("/api/tags", fetcher);

  const rows = useMemo(() => (data?.wallets ?? []).filter((w) => !hidden.has(w.id)), [data, hidden]);
  const hintsFor = useRowHints(!!rowHints, rows.map((w) => w.address));
  useEffect(() => { onRows(rows.map((w) => ({ id: w.id, name: w.displayLabel || "" }))); }, [rows]); // eslint-disable-line react-hooks/exhaustive-deps
  const total = data?.total ?? 0;
  const from = total ? page * size + 1 : 0, to = Math.min(total, (page + 1) * size);
  const pages = Math.max(1, Math.ceil(total / size));
  const narrowed = !!(statuses.length || tags.length || chains.length);
  const filtering = narrowed || !!term;
  const clearFilters = () => { setStatuses([]); setTags([]); setChains([]); };
  const fields: FilterField[] = [
    { key: "status", label: "Status", plural: "Statuses", values: statuses, onChange: setStatuses,
      options: [...QUICK_STATUSES.map((s) => ({ value: s.value, label: s.label, dot: s.tone })), { value: "none", label: "No status", dot: "bg-line" }] },
    ...((tagData?.tags.length ?? 0) > 0 ? [{ key: "tag", label: "Labels", plural: "Labels", values: tags, onChange: setTags, options: (tagData?.tags ?? []).map((t) => ({ value: t, label: t })) }] : []),
    { key: "chain", label: "Chains", plural: "Chains", values: chains, onChange: setChains, options: CHAIN_IDS.map((c) => ({ value: c, label: CHAINS[c].name, icon: <ChainIcon chain={c} /> })) },
  ];
  const exact = isAddress && rows.some((w) => w.normalizedAddress === parsed!.normalized);
  // Only once the search for this exact address has come back empty.
  const searchedFor = data && isAddress && term === parsed!.normalized && !isLoading;
  const newAddress = searchedFor && !exact && canEdit ? parsed!.raw : null;
  useEffect(() => { onNewAddress?.(newAddress); }, [newAddress]); // eslint-disable-line react-hooks/exhaustive-deps
  const chosen = rows.filter((w) => selected.has(w.id));
  const allOn = rows.length > 0 && rows.every((w) => selected.has(w.id));
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const into = scope ? { ...scope } : undefined;

  async function bulk(label: string, body: Record<string, unknown>) {
    try {
      const r = await api<{ failed: unknown[] }>("/api/wallets/bulk", { body: { ids: chosen.map((w) => w.id), ...body } });
      toast(r.failed.length ? `${label}, but ${r.failed.length} couldn't be changed.` : `${label}.`);
    } catch (e) { toast((e as Error).message); }
    setSelected(new Set());
    await refreshAll(mutate);
  }
  function hide(label: string, fn: (w: Row) => Promise<unknown>) {
    const targets = chosen, ids = targets.map((w) => w.id);
    setHidden((h) => new Set([...h, ...ids]));
    setSelected(new Set());
    undoable(label, async () => { await Promise.allSettled(targets.map(fn)); await refreshAll(mutate); }, () => setHidden((h) => new Set([...h].filter((x) => !ids.includes(x)))));
  }
  const exportHref = (format: string) => { const e = new URLSearchParams(params); for (const k of ["offset", "limit", "sort"]) e.delete(k); e.set("format", format); return `/api/wallets/export?${e}`; };

  const listContent = (
    <>
      {rows.length > 0 ? (
        <div className="overflow-hidden rounded-2xl bg-card">
          <table className="w-full table-fixed text-sm">
            <thead className="border-b border-line text-left text-xs text-muted">
              <tr>
                <th className="w-10 py-2 pl-4"><label className="-m-3.5 inline-grid cursor-pointer p-3.5"><input type="checkbox" aria-label="Select all on this page" checked={allOn} onChange={() => setSelected(allOn ? new Set() : new Set(rows.map((w) => w.id)))} /></label></th>
                <th className="py-2 pr-3 font-medium">Wallet</th>
                <th className={`hidden py-2 pr-3 font-medium sm:table-cell ${compact ? "w-[40%]" : "w-[30%]"}`}>Labels</th>
                <th className={`hidden w-[22%] py-2 pr-3 font-medium ${compact ? "" : "lg:table-cell"}`}>{scope ? "Also in" : "Filed under"}</th>
                <th className={`hidden w-24 py-2 pr-4 text-right font-medium ${compact ? "" : "md:table-cell"}`}>Updated</th>
                {renderExpanded && <th className="w-10 py-2 pr-3"><span className="sr-only">Details</span></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((w) => {
                const where = collectionsOf(w).filter((c) => c.id !== scope?.id);
                const on = openId === w.id;
                return (
                  <Fragment key={w.id}>
                  <tr aria-selected={on} aria-expanded={renderExpanded ? on : undefined} onClick={() => onOpen(w.id)}
                    onPointerEnter={prefetch ? () => void preload(`/api/wallets/${w.id}`, fetcher) : undefined}
                    className={`group cursor-pointer transition-colors duration-150 ${on ? "bg-wash" : selected.has(w.id) ? "bg-wash/70" : "hover:bg-wash/50"}`}>
                    {/* The open wallet's row carries an accent edge, tying it to whatever shows its details. */}
                    <td className={`py-2.5 pl-4 align-middle transition-shadow duration-150 ${on ? "shadow-[inset_3px_0_0_var(--accent)]" : ""}`} onClick={(e) => e.stopPropagation()}>
                      <label className="-m-3.5 inline-grid cursor-pointer p-3.5"><input type="checkbox" aria-label={`Select ${w.displayLabel || w.address}`} checked={selected.has(w.id)} onChange={() => toggle(w.id)} /></label>
                    </td>
                    <td className="min-w-0 py-2.5 pr-3">
                      <button className="block w-full min-w-0 text-left" onClick={(e) => { e.stopPropagation(); onOpen(w.id); }}>
                        <FadeText className="font-medium">{w.displayLabel || <span className="text-muted">Unnamed wallet</span>}</FadeText>
                        <FadeText className="text-xs text-muted"><ChainIcon chain={w.chain} className="mr-1 inline-block size-3 align-[-2px]" /><span className="addr">{truncateAddress(w.address)}</span> · {CHAINS[w.chain as keyof typeof CHAINS]?.name ?? w.chain}</FadeText>
                        {rowHints && hintsFor(w.address, w.id).length > 0 && <span className="mt-1 flex min-w-0"><ClaimHint labels={hintsFor(w.address, w.id)} /></span>}
                      </button>
                    </td>
                    <td className="hidden py-2.5 pr-3 sm:table-cell"><LabelChips status={w.status} tags={w.tags} max={3} /></td>
                    <td className={`hidden py-2.5 pr-3 text-xs text-muted ${compact ? "" : "lg:table-cell"}`}>
                      {where.length ? (
                        <span className="flex min-w-0 items-center gap-1" title={where.map((c) => c.name).join(", ")}>
                          <KindIcon kind={where[0]!.kind} className="size-3.5 shrink-0" /><FadeText className="min-w-0">{where[0]!.name}</FadeText>{where.length > 1 && <span className="shrink-0">+{where.length - 1}</span>}
                        </span>
                      ) : !scope ? <span className="text-muted">—</span> : null}
                    </td>
                    <td className={`hidden py-2.5 pr-4 text-right text-xs whitespace-nowrap text-muted ${compact ? "" : "md:table-cell"}`}>{ago(w.updatedAt)}</td>
                    {renderExpanded && (
                      <td className="pr-3 text-right align-middle">
                        <span className={`inline-grid size-7 place-items-center rounded-full text-muted transition-[transform,background-color,color] duration-200 ease-out group-hover:bg-card group-hover:text-ink ${on ? "rotate-180 bg-card text-ink" : ""}`}>
                          <Icon name="chevronDown" className="size-3.5" />
                        </span>
                      </td>
                    )}
                  </tr>
                  {renderExpanded && (on || closing === w.id) && (
                    <tr className="bg-wash/40">
                      <td colSpan={cols} className="p-0">
                        <Unfold open={on}>{renderExpanded(w.id)}</Unfold>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          <nav aria-label="Pages" className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-1.5 text-xs text-muted">
            <span className="tabular-nums">{from}–{to} of {total}</span>
            <SelectMenu label="Per page" value={String(size)} onChange={(v) => setSize(Number(v))} options={SIZES.map((n) => ({ value: String(n), label: String(n) }))}
              buttonClass="inline-flex h-8 items-center gap-1 rounded-full px-2 hover:bg-wash hover:text-ink" />
            <span className="ml-auto flex items-center gap-1">
              <IconButton icon="chevronLeft" label="Previous page" disabled={page === 0} onClick={() => setPage((p) => p - 1)} />
              <span className="tabular-nums">Page {page + 1} of {pages}</span>
              <IconButton icon="chevronRight" label="Next page" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)} />
            </span>
          </nav>
        </div>
      ) : !data ? (
        <div aria-busy className="overflow-hidden rounded-2xl bg-card">
          <div className="border-b border-line px-4 py-2.5"><Bone className="h-3 w-24" /></div>
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex items-center gap-4 border-b border-line px-4 py-3 last:border-0">
              <Bone className="size-4 rounded" />
              <span className="flex-1 space-y-1.5"><Bone className="h-3.5 w-36" /><Bone className="h-3 w-48" /></span>
              <Bone className="hidden h-5 w-16 rounded-full sm:block" /><Bone className="hidden h-5 w-12 rounded-full sm:block" />
            </div>
          ))}
        </div>
      ) : isAddress ? null : (
        <div className="rounded-2xl bg-card px-6 py-12 text-center">
          <p className="font-medium">{filtering ? "No matches" : scope ? `Nothing in ${scope.name} yet` : unfiled ? "Everything is filed" : "No wallets yet"}</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-pretty text-muted">
            {filtering ? "Try fewer filters, or search for something else."
              : scope ? "Add an address here, or paste one in the search bar."
                : unfiled ? "Every wallet is on a contact or in a list. New ones land here until you file them." : "Name an address you want to remember. That's all a wallet is here."}
          </p>
          {filtering
            ? <Button className={`mt-4 ${press}`} onClick={clearFilters}>Clear filters</Button>
            : canEdit && <Button variant="primary" className={`mt-4 ${press}`} onClick={() => addWallet({ into })}>Add wallet{scope ? ` to ${scope.name}` : ""}</Button>}
        </div>
      )}
    </>
  );

  return (
    <div className="space-y-3">
      {!pageView && newAddress && renderNewAddress?.(newAddress)}
      {!pageView && newAddress && !renderNewAddress && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-card py-2.5 pr-2.5 pl-4 text-sm">
          <span><span className="addr">{truncateAddress(newAddress)}</span> isn&apos;t in {scope ? scope.name : "your wallets"} yet.</span>
          <Button variant="primary" className={press} onClick={() => addWallet({ address: newAddress, into })}>Add wallet{scope ? ` to ${scope.name}` : ""}</Button>
        </div>
      )}

      {pageView ? pageView.bar : <>
      {/* One line: filters grow from the left, sort and more stay pinned right. */}
      <div className="@container flex items-start gap-2" role="toolbar" aria-label="Filters">
        <FilterBar fields={fields} onClearAll={clearFilters} />
        <span className="flex shrink-0 items-center gap-2">
          <SelectMenu label="Sort" ariaLabel={`Sort: ${SORTS.find((x) => x.value === sort)?.label}`} icon="sort" valueClass="hidden @min-[38rem]:inline" value={sort} onChange={setSort} options={SORTS} align="right" />
          <Menu label={<Icon name="more" />} ariaLabel="Import or export" buttonClass={`inline-flex h-8 items-center rounded-full bg-card px-2.5 text-muted hover:text-ink ${press} ${hit}`}>
            {(close) => (
              <>
                {canEdit && <button className={menuItem} onClick={() => { close(); setImporting(true); }}>Import CSV or JSON{scope ? ` into ${scope.name}` : ""}</button>}
                <a className={menuItem} href={exportHref("csv")} onClick={close}>Export {filtering ? "matches" : "all"} as CSV</a>
                <a className={menuItem} href={exportHref("json")} onClick={close}>Export {filtering ? "matches" : "all"} as JSON</a>
              </>
            )}
          </Menu>
        </span>
      </div>
      {importing && <ImportDialog scope={scope} onClose={() => setImporting(false)} />}

      </>}

      {!pageView && chosen.length > 0 && (
        <div className="sticky top-17 z-20 flex flex-wrap items-center gap-1 rounded-xl bg-ink p-1.5 text-sm text-paper shadow-lg">
          <span className="px-2 font-medium">{chosen.length} selected</span>
          <Menu label="File under…" buttonClass={`rounded-md px-2.5 py-1.5 hover:bg-paper/15 ${press}`} align="left">
            {(close) => (
              <div className="w-72 p-1.5 text-ink">
                <CollectionPicker autoFocus label="File under" placeholder="A contact or list, or a new name" exclude={scope ? [scope.id] : []} onSelect={async (c) => {
                  close();
                  const target = await resolveCollection(c);
                  if (target.kind === "list") {
                    const r = await Promise.allSettled(chosen.map((w) => addToCollection(target, w.id)));
                    toast(`Added to ${target.name}${r.some((x) => x.status === "rejected") ? ", with some failures" : ""}.`);
                    setSelected(new Set()); await refreshAll(mutate);
                  } else await bulk(`Linked to ${target.name}`, { op: "linkEntity", entityId: target.id });
                }} />
              </div>
            )}
          </Menu>
          <SelectMenu label="Set status" allLabel="Set status" ariaLabel="Set status" value="" onChange={(v) => v && void bulk(v === "none" ? "Cleared status" : "Status set", { op: "setStatus", status: v })}
            options={[...QUICK_STATUSES.map((s) => ({ value: s.value, label: s.label, dot: s.tone })), { value: "none", label: "No status" }]}
            buttonClass="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 hover:bg-paper/15" />
          <Menu label="Add label" buttonClass={`rounded-md px-2.5 py-1.5 hover:bg-paper/15 ${press}`} align="left">
            {(close) => (
              <form className="w-64 space-y-1.5 p-1.5 text-ink" onSubmit={(e) => {
                e.preventDefault();
                const t = String(new FormData(e.currentTarget).get("tag") ?? "").trim().toLowerCase();
                if (!t) return;
                close(); void bulk(`Labeled ${t}`, { op: "addTag", tag: t });
              }}>
                <label htmlFor="bulk-tag" className="block px-0.5 text-xs font-medium text-muted">Label to add</label>
                <span className="flex gap-2">
                  <input id="bulk-tag" name="tag" autoFocus placeholder="e.g. whale" className="h-9 min-w-0 flex-1 rounded-md border border-line bg-card px-2.5 text-sm placeholder:text-muted" />
                  <Button type="submit" className={press}>Add</Button>
                </span>
              </form>
            )}
          </Menu>
          <span className="ml-auto flex items-center gap-1">
            {confirmDelete ? (
              <>
                <span className="px-2">Delete {chosen.length} wallet{chosen.length === 1 ? "" : "s"}?</span>
                <button key="cancel-delete" className={`rounded-md px-2.5 py-1.5 hover:bg-paper/15 ${press}`} onClick={() => setConfirmDelete(false)}>Cancel</button>
                <button key="confirm-delete" autoFocus className={`rounded-md bg-bad px-2.5 py-1.5 font-medium text-card ${press}`} onClick={() => hide(`Deleted ${chosen.length} wallet${chosen.length === 1 ? "" : "s"}`, (w) => api(`/api/wallets/${w.id}`, { method: "DELETE" }))}>Delete</button>
              </>
            ) : <>
            {scope && canEdit && <button className={`rounded-md px-2.5 py-1.5 hover:bg-paper/15 ${press}`} onClick={() => hide(`Removed ${chosen.length} from ${scope.name}`, (w) => removeFromCollection(scope, w.id))}>Remove from {scope.kind === "list" ? "list" : scope.name}</button>}
            {chosen.every((w) => w.own) && <button className={`rounded-md px-2.5 py-1.5 text-[color:var(--bad)] hover:bg-paper/15 ${press}`} onClick={() => setConfirmDelete(true)}>Delete…</button>}
            <button aria-label="Clear selection" className={`grid size-8 place-items-center rounded-md hover:bg-paper/15 ${press} ${hit}`} onClick={() => setSelected(new Set())}><Icon name="x" /></button>
            </>}
          </span>
        </div>
      )}

      {transition
        ? <ContentSurface key={transition} variant={transition} k={pageView ? `wallet:${pageView.key}` : "list"}>{pageView ? pageView.content : listContent}</ContentSurface>
        : listContent}
    </div>
  );
}

/**
 * Inline details fold open and shut (height and opacity, ease-out) instead of popping in,
 * then scroll into view once the fold finishes, if they ended up off screen.
 */
function Unfold({ open, children }: { open: boolean; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(open));
    if (!open) return () => cancelAnimationFrame(raf);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = setTimeout(() => ref.current?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" }), reduce ? 0 : 280);
    return () => { cancelAnimationFrame(raf); clearTimeout(t); };
  }, [open]);
  return (
    <div ref={ref} className={`grid scroll-mt-20 scroll-mb-4 motion-safe:transition-[grid-template-rows,opacity] motion-safe:duration-[260ms] motion-safe:ease-[cubic-bezier(0.2,0,0,1)] ${shown ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}
