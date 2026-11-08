"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { CHAIN_IDS, CHAINS, chainFamily, inferFamily, type ChainId } from "@tagawallet/shared";
import { api, ClientError, fetcher } from "@/lib/client";
import { Address, Button, ChainName, ErrorNote, Input, Select, VerificationPill } from "./ui";
import { AutoField, LabelPicker, useToast } from "./kit";
import { addToCollection, CollectionChip, collectionsOf, CollectionPicker, removeFromCollection, resolveCollection } from "./collections";
import { LinkEditor, type LinkRow } from "./link-editor";

/** Wallets open in a drawer over whatever page you're on, addressed by ?w= so links and Back work. */
export function useOpenWallet() {
  const router = useRouter(), path = usePathname(), params = useSearchParams();
  return useCallback((id: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (id) next.set("w", id); else next.delete("w");
    const qs = next.toString();
    router.push(`${path}${qs ? `?${qs}` : ""}`, { scroll: false });
  }, [router, path, params]);
}

export const refreshAll = (mutate: ReturnType<typeof useSWRConfig>["mutate"]) => mutate((k) => typeof k === "string" && k.startsWith("/api/"));

export function WalletDrawer() {
  const id = useSearchParams().get("w");
  const open = useOpenWallet();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (id && d && !d.open) d.showModal();
    if (!id && d?.open) d.close();
  }, [id]);
  return (
    <dialog ref={ref} onClose={() => id && open(null)} aria-label="Wallet"
      className="ml-auto mr-0 h-dvh max-h-dvh w-[min(30rem,100vw)] max-w-none border-0 border-l border-line bg-card p-0 text-ink open:animate-[slide_160ms_ease-out]">
      {id && <WalletPanel key={id} id={id} onClose={() => open(null)} />}
    </dialog>
  );
}

function WalletPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: w, error, mutate } = useSWR(`/api/wallets/${id}`, fetcher);
  const { mutate: mutateAll } = useSWRConfig();
  const { undoable, toast } = useToast();
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [problem, setProblem] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => { if (w) setLinks(w.links ?? []); }, [w?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const patch = async (body: object) => {
    setProblem("");
    try {
      const next = await api(`/api/wallets/${id}`, { method: "PATCH", body });
      await mutate(next, { revalidate: false });
      void refreshAll(mutateAll);
    } catch (e) { setProblem((e as Error).message); throw e; }
  };
  const run = async (fn: () => Promise<unknown>) => {
    setProblem("");
    try { await fn(); await mutate(); void refreshAll(mutateAll); } catch (e) { setProblem((e as Error).message); }
  };

  if (error) return <div className="p-5"><Header onClose={onClose} title="Wallet not found" /><p className="text-sm text-muted">It may have been deleted, or you may not have access.</p></div>;
  if (!w) return <div className="p-5"><Header onClose={onClose} title="" /><p className="text-sm text-muted">Loading…</p></div>;


  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-5 overflow-y-auto p-5">
        <Header onClose={onClose} title={w.displayLabel || "Unnamed wallet"} />
        <div className="-mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
          <Address value={w.address} /> · <ChainName chain={w.chain} />
          <button className="underline-offset-2 hover:underline" onClick={async () => { await navigator.clipboard.writeText(w.address); setCopied(true); }}>{copied ? "Copied" : "Copy"}</button>
          <a className="underline-offset-2 hover:underline" target="_blank" rel="noreferrer noopener" href={w.explorerUrl}>Explorer ↗</a>
        </div>

        {w.own && <ChangeAddress wallet={w} onSaved={async (next) => { await mutate(next, { revalidate: false }); void refreshAll(mutateAll); }} />}

        <AutoField label="Name" value={w.displayLabel} placeholder="Alice's trading wallet" onSave={(displayLabel) => patch({ displayLabel })} className="text-base font-medium" />

        <div className="space-y-1.5 px-2">
          <span className="text-xs font-medium text-muted">Labels</span>
          <LabelPicker value={{ status: w.status ?? "none", tags: w.tags ?? [] }} onChange={(v) => void patch({ status: v.status, tags: v.tags }).catch(() => {})} />
        </div>

        <AutoField label="Notes" multiline value={w.notes ?? ""} placeholder="Where you saw it, who told you, anything worth remembering" onSave={(notes) => patch({ notes })} />

        <section className="space-y-2 px-2">
          <h3 className="text-xs font-medium text-muted">Lists</h3>
          {collectionsOf(w).length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {collectionsOf(w).map((c) => (
                <CollectionChip key={`${c.kind}-${c.id}`} c={c} onRemove={c.canEdit ? () => run(() => removeFromCollection(c, id)) : undefined} />
              ))}
            </div>
          ) : <p className="text-sm text-muted">Not in any list. That&apos;s fine: it&apos;s saved and private to you.</p>}
          <CollectionPicker placeholder="Add to a list, person or project" exclude={collectionsOf(w).map((c) => c.id)}
            onSelect={(c) => run(async () => addToCollection(await resolveCollection(c), id))} />
          {w.lists.some((l: any) => l.visibility === "shared") && <p className="text-xs text-muted">People on shared lists see this wallet&apos;s name, labels and notes.</p>}
        </section>

        <details className="group px-2">
          <summary className="cursor-pointer list-none text-xs font-medium text-muted hover:text-ink">Links {links.length ? `(${links.length})` : ""} <span className="group-open:hidden">▸</span><span className="hidden group-open:inline">▾</span></summary>
          <p className="mt-1 mb-2 text-xs text-muted">Official links usually belong on the person or project. Use these for one-off sources.</p>
          <LinkEditor value={links} onChange={setLinks} defaultStatus="source" onCommit={(next) => void patch({ links: next.filter((l) => l.url.trim()) }).catch(() => {})} />
        </details>

        <ErrorNote>{problem}</ErrorNote>
      </div>
      <footer className="flex items-center justify-between gap-3 border-t border-line px-5 py-3 text-xs text-muted">
        <span>Added {new Date(w.createdAt).toLocaleDateString()} · {w.source}</span>
        {w.own && (
          <Button variant="ghost" className="text-bad" onClick={() => {
            onClose();
            void mutateAll((k) => typeof k === "string" && k.startsWith("/api/wallets?"), (d: any) => (d?.wallets ? { ...d, wallets: d.wallets.filter((x: any) => x.id !== id) } : d), { revalidate: false });
            undoable("Wallet deleted", async () => { await api(`/api/wallets/${id}`, { method: "DELETE" }); await refreshAll(mutateAll); }, () => { void refreshAll(mutateAll); toast("Kept the wallet"); });
          }}>Delete wallet</Button>
        )}
      </footer>
    </div>
  );
}

/** Fixes a typo'd address or the wrong chain in place, keeping the name, notes and lists. */
function ChangeAddress({ wallet, onSaved }: { wallet: any; onSaved: (next: any) => Promise<void> }) {
  const openWallet = useOpenWallet();
  const [open, setOpen] = useState(false);
  const [address, setAddress] = useState(wallet.address), [chain, setChain] = useState<string>(wallet.chain);
  const [error, setError] = useState(""), [twin, setTwin] = useState<string | null>(null), [busy, setBusy] = useState(false);
  // Chains that fit the address being typed. An EVM address works on every EVM chain.
  const family = inferFamily(address.trim()) ?? chainFamily(wallet.chain as ChainId);
  const options = CHAIN_IDS.filter((c) => CHAINS[c].family === family);
  const chosen = options.includes(chain as ChainId) ? chain : options[0]!;
  if (!open) return <button className="-mt-3 px-2 text-xs text-muted underline-offset-2 hover:text-ink hover:underline" onClick={() => setOpen(true)}>Change address or chain</button>;
  return (
    <form className="-mt-2 space-y-2 rounded-lg bg-wash p-3" onSubmit={async (e) => {
      e.preventDefault();
      setError(""); setTwin(null); setBusy(true);
      try {
        const next = await api(`/api/wallets/${wallet.id}`, { method: "PATCH", body: { address: address.trim(), chain: chosen } });
        await onSaved(next);
        setOpen(false);
      } catch (err) {
        setError((err as Error).message);
        if (err instanceof ClientError && err.data.walletId) setTwin(err.data.walletId);
      } finally { setBusy(false); }
    }}>
      <Input aria-label="Address" className="font-mono text-xs" spellCheck={false} value={address} onChange={(e) => setAddress(e.target.value)} />
      <Select aria-label="Chain" value={chosen} onChange={(e) => setChain(e.target.value)}>
        {options.map((c) => <option key={c} value={c}>{CHAINS[c].name}</option>)}
      </Select>
      <ErrorNote>{error}</ErrorNote>
      {twin && <button type="button" className="text-xs underline" onClick={() => openWallet(twin)}>Open that wallet</button>}
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={busy}>Save</Button>
        <Button type="button" onClick={() => { setOpen(false); setAddress(wallet.address); setChain(wallet.chain); setError(""); setTwin(null); }}>Cancel</Button>
      </div>
    </form>
  );
}

function Header({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <h2 className="min-w-0 truncate text-xl font-semibold tracking-tight">{title}</h2>
      <Button variant="ghost" aria-label="Close" onClick={onClose}>✕</Button>
    </div>
  );
}
