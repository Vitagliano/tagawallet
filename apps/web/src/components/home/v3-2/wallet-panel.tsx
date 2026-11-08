"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { CHAINS, RELATIONSHIPS, type Relationship } from "@tagawallet/shared";
import { api, fetcher } from "@/lib/client";
import { ErrorNote } from "@/components/ui";
import { AutoField, LabelPicker, useToast } from "@/components/kit";
import { addToCollection, collectionsOf, CollectionPicker, KindIcon, kindLabel, relationshipLabel, removeFromCollection, resolveCollection } from "@/components/collections";
import { ChangeAddress, refreshAll } from "@/components/wallet-drawer";
import { LinkEditor, type LinkRow } from "@/components/link-editor";
import { ago, initials } from "../shared";
import { SelectMenu } from "./select-menu";
import { ChainIcon } from "./chain-icon";
import { Bone, CopyButton, FadeText, hit, Icon, IconButton, press } from "./ui";
import { ClaimHint, suggestedName, useAddressIntel } from "@/components/features/address-intel";

/** j/k or ↑/↓ step through the wallets on this page, Esc closes. Ignored while typing or in a menu. */
export function useWalletKeys(id: string, ids: string[], onOpen: (id: string) => void, onClose: () => void) {
  const at = ids.indexOf(id);
  const prev = at > 0 ? ids[at - 1] : undefined, next = at >= 0 && at < ids.length - 1 ? ids[at + 1] : undefined;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable], [role=listbox], [role=menu]")) return;
      if (e.key === "Escape") onClose();
      if ((e.key === "ArrowDown" || e.key === "j") && next) { e.preventDefault(); onOpen(next); }
      if ((e.key === "ArrowUp" || e.key === "k") && prev) { e.preventDefault(); onOpen(prev); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, onOpen, onClose]);
  return { at, prev, next };
}

/** Previous / next / "3 of 25" / close, shared by every way of opening a wallet. */
export function StepBar({ id, ids, onOpen, onClose, children }: { id: string; ids: string[]; onOpen: (id: string) => void; onClose: () => void; children?: React.ReactNode }) {
  const { at, prev, next } = useWalletKeys(id, ids, onOpen, onClose);
  return (
    <div className="flex items-center gap-1 text-xs text-muted">
      {children}
      <IconButton icon="arrowUp" label="Previous wallet (k)" disabled={!prev} onClick={() => prev && onOpen(prev)} />
      <IconButton icon="arrowDown" label="Next wallet (j)" disabled={!next} onClick={() => next && onOpen(next)} />
      {at >= 0 && <span className="pl-1 tabular-nums">{at + 1} of {ids.length} on this page</span>}
      <IconButton icon="x" label="Close (Esc)" onClick={onClose} className="ml-auto" />
    </div>
  );
}

/**
 * Peek: a panel that floats over the right edge of the page. Nothing underneath moves or disappears;
 * click another row to swap. It enters and leaves on the same short path (ease-out in, ease-in out).
 */
export function FloatingWalletPanel({ id, ids, onOpen, onClose }: { id: string; ids: string[]; onOpen: (id: string) => void; onClose: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const close = useCallback(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return onClose();
    setLeaving(true);
    setTimeout(onClose, 120);
  }, [onClose]);
  return (
    <aside role="dialog" aria-modal="false" aria-label="Wallet"
      className={`fixed inset-x-2 bottom-2 z-30 flex max-h-[85dvh] flex-col overflow-hidden surface-raised rounded-2xl text-ink md:inset-x-auto md:top-20 md:right-4 md:bottom-4 md:max-h-none md:w-[24rem] ${leaving ? "motion-safe:animate-[panel-out_120ms_ease-in_forwards]" : "motion-safe:animate-[panel-in_180ms_ease-out]"}`}>
      <span aria-hidden className="mx-auto mt-2 h-1 w-10 rounded-full bg-line md:hidden" />
      <div className="px-2 pt-2 pb-1"><StepBar id={id} ids={ids} onOpen={onOpen} onClose={close} /></div>
      <WalletDetails key={id} id={id} onClose={close} />
    </aside>
  );
}

/** "field" errors are shown by the field itself (AutoField), so they are not repeated here. */
type Part = "field" | "labels" | "contacts" | "lists" | "links" | "general";

function Section({ title, children, error, id }: { title: string; children: React.ReactNode; error?: string; id: string }) {
  return (
    <section aria-labelledby={id} className="space-y-3">
      <h3 id={id} className="text-xs font-medium text-muted">{title}</h3>
      {children}
      {error && <ErrorNote>{error}</ErrorNote>}
    </section>
  );
}

function Loading({ wide }: { wide?: boolean }) {
  return (
    <div aria-busy className={wide ? "grid gap-6 p-5 md:grid-cols-2 [&>*]:space-y-6" : "space-y-6 p-4"}>
      <div className="flex gap-3"><Bone className="size-11 rounded-full" /><span className="flex-1 space-y-2 pt-1"><Bone className="h-3 w-12" /><Bone className="h-5 w-40" /></span></div>
      <Bone className="h-[4.5rem] w-full rounded-xl" />
      <div className="space-y-3"><Bone className="h-3 w-14" /><span className="flex gap-1.5">{[0, 1, 2, 3].map((i) => <Bone key={i} className="h-7 w-20 rounded-full" />)}</span><Bone className="h-9 w-full rounded-md" /></div>
      <div className="space-y-3"><Bone className="h-3 w-20" /><Bone className="h-14 w-full rounded-xl" /></div>
      <div className="space-y-3"><Bone className="h-3 w-10" /><Bone className="h-9 w-full rounded-md" /></div>
    </div>
  );
}

/**
 * Everything about one wallet. Narrow (a panel) stacks it; wide (inline or a page) puts
 * "who it is" (name, address, notes) beside "how it's filed" (labels, contacts, lists).
 */
export function WalletDetails({ id, onClose, wide = false }: { id: string; onClose: () => void; wide?: boolean }) {
  const { data: w, error, mutate } = useSWR(`/api/wallets/${id}`, fetcher);
  const intel = useAddressIntel(w ? [w.address] : []);
  // This wallet's own record, when it reaches you through a shared list, isn't something "elsewhere".
  const elsewhere = w ? intel.get(w.address).filter((l) => l.walletId !== w.id) : [];
  const { mutate: mutateAll } = useSWRConfig();
  const { undoable, toast } = useToast();
  // Each error shows in the section that caused it, not in a pile at the bottom.
  const [problem, setProblem] = useState<{ part: Part; message: string } | null>(null);
  const [more, setMore] = useState(false), [confirming, setConfirming] = useState(false);
  const [links, setLinks] = useState<LinkRow[]>([]);
  useEffect(() => { if (w) setLinks(w.links ?? []); }, [w?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const errorFor = (part: Part) => (problem?.part === part ? problem.message : undefined);

  const patch = (part: Part) => async (body: object) => {
    setProblem(null);
    try { await mutate(await api(`/api/wallets/${id}`, { method: "PATCH", body }), { revalidate: false }); void refreshAll(mutateAll); }
    catch (e) { setProblem({ part, message: (e as Error).message }); throw e; }
  };
  const run = (part: Part, fn: () => Promise<unknown>) => async () => {
    setProblem(null);
    try { await fn(); await mutate(); void refreshAll(mutateAll); } catch (e) { setProblem({ part, message: (e as Error).message }); }
  };

  if (error) return <p className="p-5 text-sm text-muted">This wallet is gone, or you no longer have access.</p>;
  if (!w) return <Loading wide={wide} />;

  const contacts = collectionsOf(w).filter((c) => c.kind !== "list");
  const lists = collectionsOf(w).filter((c) => c.kind === "list");
  const remove = () => {
    onClose();
    void mutateAll((k) => typeof k === "string" && k.startsWith("/api/wallets?"), (d: any) => (d?.wallets ? { ...d, wallets: d.wallets.filter((x: any) => x.id !== id), total: Math.max(0, (d.total ?? 1) - 1) } : d), { revalidate: false });
    undoable("Wallet deleted", async () => { await api(`/api/wallets/${id}`, { method: "DELETE" }); await refreshAll(mutateAll); }, () => { void refreshAll(mutateAll); toast("Kept the wallet"); });
  };

  return (
    <>
      <div className={wide ? "grid gap-x-10 gap-y-6 p-5 md:grid-cols-2" : "scroll-fade-y flex-1 space-y-6 overflow-y-auto px-4 pt-2 pb-5"}>
        <div className="min-w-0 space-y-6">
        {/* Who it is: a name you can edit in place, the full address, and where to look it up. */}
        <div className="flex items-start gap-3">
          <span aria-hidden className="mt-1 grid size-11 shrink-0 place-items-center rounded-full bg-wash text-sm font-semibold text-muted">{initials(w.displayLabel || "0x")}</span>
          <div className="min-w-0 flex-1">
            <AutoField label="Name" value={w.displayLabel ?? ""} placeholder="Name this wallet" onSave={(displayLabel) => patch("field")({ displayLabel })} className="-mx-2 text-lg font-semibold" />
          </div>
        </div>
        <div className="rounded-xl bg-wash p-3">
          <p className="addr text-xs leading-relaxed break-all">{w.address}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-card py-1 pr-2.5 pl-1.5 font-medium"><ChainIcon chain={w.chain} className="size-3.5" />{CHAINS[w.chain as keyof typeof CHAINS]?.name ?? w.chain}</span>
            <CopyButton text={w.address} className="rounded-full px-1 py-1 text-muted hover:text-ink" />
            <a target="_blank" rel="noreferrer noopener" href={w.explorerUrl} className={`inline-flex items-center gap-1.5 rounded-full px-1 py-1 text-muted hover:text-ink ${press} ${hit}`}>
              <Icon name="external" className="size-3.5" />Explorer
            </a>
          </div>
        </div>

        {elsewhere.length > 0 && (
          <div className="-mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
            <span>Others call it</span><ClaimHint labels={elsewhere} />
            {!w.displayLabel && suggestedName(elsewhere) && (
              <button className={`font-medium text-accent hover:underline ${press}`} onClick={() => void patch("field")({ displayLabel: suggestedName(elsewhere) }).catch(() => {})}>Use this name</button>
            )}
          </div>
        )}

        <AutoField label="Notes" multiline value={w.notes ?? ""} placeholder="Where you saw it, who told you, anything worth remembering" onSave={(notes) => patch("field")({ notes })} className="-mx-2" />
        </div>

        <div className="min-w-0 space-y-6">
        <Section id={`labels-${id}`} title="Labels" error={errorFor("labels")}>
          <LabelPicker label="Labels" value={{ status: w.status ?? "none", tags: w.tags ?? [] }} onChange={(v) => void patch("labels")({ status: v.status, tags: v.tags }).catch(() => {})} />
        </Section>

        <Section id={`contacts-${id}`} title="Belongs to" error={errorFor("contacts")}>
          {contacts.map((c) => {
            const link = (w.entities ?? []).find((e: any) => (e.id ?? e._id) === c.id);
            const role = (link?.relationship ?? "associated") as Relationship;
            return (
              <div key={c.id} className="flex items-center gap-2.5 rounded-xl bg-wash/60 py-2 pr-1.5 pl-3">
                <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-card text-xs font-semibold text-muted">{initials(c.name)}</span>
                <span className="min-w-0 flex-1">
                  <Link href={c.href} className="block text-sm font-medium hover:underline"><FadeText>{c.name}</FadeText></Link>
                  <span className="text-xs text-muted">{kindLabel(c.kind)}</span>
                </span>
                {w.own && (
                  <SelectMenu label="Role" value={role} align="right" ariaLabel={`Role for ${c.name}: ${relationshipLabel(role)}`}
                    onChange={(r) => void run("contacts", () => api(`/api/entities/${c.id}/wallets`, { body: { walletId: id, relationship: r, visibility: link?.linkVisibility ?? "private" } }))()}
                    options={RELATIONSHIPS.map((r) => ({ value: r, label: relationshipLabel(r) }))}
                    buttonClass="inline-flex h-8 items-center gap-1 rounded-full bg-card px-2.5 text-xs font-medium hover:bg-line/60" />
                )}
                {c.canEdit && <IconButton icon="x" label={`Unlink ${c.name}`} onClick={run("contacts", () => removeFromCollection(c, id))} />}
              </div>
            );
          })}
          {w.own && (
            <CollectionPicker label={contacts.length ? "Add another contact" : "Link to a contact"} placeholder={contacts.length ? "Add another contact" : "Who's behind it? Find or create a contact"} kinds={["person", "project"]}
              exclude={contacts.map((c) => c.id)} onSelect={(c) => void run("contacts", async () => addToCollection(await resolveCollection(c), id))()} />
          )}
        </Section>

        <Section id={`lists-${id}`} title="Lists" error={errorFor("lists")}>
          {lists.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {lists.map((c) => (
                <span key={c.id} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-wash pr-0.5 pl-3 text-xs font-medium">
                  <KindIcon kind="list" className="size-3.5 text-muted" />
                  <Link href={c.href} className="hover:underline">{c.name}</Link>
                  {c.canEdit && <button aria-label={`Remove from ${c.name}`} className={`grid size-7 place-items-center rounded-full text-muted hover:bg-card hover:text-ink ${press} ${hit}`} onClick={run("lists", () => removeFromCollection(c, id))}><Icon name="x" className="size-3.5" /></button>}
                </span>
              ))}
            </div>
          )}
          <CollectionPicker label="Add to a list" placeholder="Add to a list" kinds={["list"]} exclude={lists.map((c) => c.id)}
            onSelect={(c) => void run("lists", async () => addToCollection(await resolveCollection(c), id))()} />
          {w.lists?.some((l: any) => l.visibility === "shared") && <p className="text-xs text-pretty text-muted">People on shared lists see this wallet&apos;s name, labels and notes.</p>}
        </Section>


        <div>
          <button aria-expanded={more} onClick={() => setMore((m) => !m)} className={`flex min-h-11 w-full items-center justify-between text-xs font-medium text-muted hover:text-ink ${press}`}>
            <span>Sources, address and more{links.length ? ` · ${links.length} link${links.length === 1 ? "" : "s"}` : ""}</span>
            <Icon name="chevronDown" className={`size-3.5 transition-transform duration-150 ease-out ${more ? "rotate-180" : ""}`} />
          </button>
          {more && (
            <div className="mt-2 space-y-6">
              <Section id={`links-${id}`} title="Sources" error={errorFor("links")}>
                <p className="-mt-1 text-xs text-pretty text-muted">Where this came from. Official links usually belong on the contact.</p>
                <LinkEditor value={links} onChange={setLinks} defaultStatus="source" onCommit={(nextLinks) => void patch("links")({ links: nextLinks.filter((l) => l.url.trim()) }).catch(() => {})} />
              </Section>
              {w.own && <div className="pt-3"><ChangeAddress wallet={w} onSaved={async (n) => { await mutate(n, { revalidate: false }); void refreshAll(mutateAll); }} /></div>}
            </div>
          )}
        </div>
        {errorFor("general") && <ErrorNote>{errorFor("general")}</ErrorNote>}
        </div>
      </div>

      <footer className={`flex min-h-14 items-center justify-between gap-3 bg-wash/50 py-2 text-xs text-muted ${wide ? "px-5" : "px-4"}`}>
        {confirming ? (
          <>
            <span className="text-pretty text-ink">Delete this wallet? You can undo for a few seconds.</span>
            <span className="flex shrink-0 gap-2">
              <button className={`min-h-9 rounded-lg px-3 font-medium text-ink hover:bg-card ${press}`} onClick={() => setConfirming(false)}>Cancel</button>
              <button autoFocus className={`min-h-9 rounded-lg bg-bad px-3 font-medium text-card ${press}`} onClick={remove}>Delete</button>
            </span>
          </>
        ) : (
          <>
            <span title={new Date(w.createdAt).toLocaleString()}>Added {ago(w.createdAt)}{w.source ? ` · via ${w.source}` : ""}</span>
            {w.own && (
              <button className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 hover:bg-card hover:text-bad ${press}`} onClick={() => setConfirming(true)}>
                <Icon name="trash" className="size-3.5" />Delete
              </button>
            )}
          </>
        )}
      </footer>
    </>
  );
}
