"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useContext, useState, type ReactNode } from "react";
import useSWR, { useSWRConfig } from "swr";
import { CHAIN_IDS, CHAINS, addressError, inferFamily, parsePastedAddress } from "@tagawallet/shared";
import { api, ClientError, fetcher } from "@/lib/client";
import { Button, ErrorNote, Modal } from "./ui";
import { LabelPicker, useToast, type Labels } from "./kit";

/**
 * People, projects and plain lists are one idea to the person using the app: a list of wallets.
 * Underneath, a person or project is an entity (it can be verified and published) and a plain list
 * is a list (it can be shared). This module is the only place that knows the difference.
 */
export type Kind = "list" | "person" | "project";
export type Collection = { kind: Kind; id: string; name: string; count: number; shared: boolean; isPublic: boolean; verified: boolean; canEdit: boolean; href: string; tags: string[]; avatarUrl?: string };
export type CollectionChoice = { kind: Kind; id?: string; name: string };

export const KINDS: { kind: Kind; label: string; plural: string; hint: string }[] = [
  { kind: "list", label: "List", plural: "Lists", hint: "Any group of wallets. Can be shared with your team." },
  { kind: "person", label: "Person", plural: "People", hint: "Wallets one person controls." },
  { kind: "project", label: "Project", plural: "Projects", hint: "Wallets of a project, company, DAO or exchange." },
];
export const kindLabel = (k: Kind) => KINDS.find((x) => x.kind === k)!.label;

export function KindIcon({ kind, className = "" }: { kind: Kind; className?: string }) {
  const paths: Record<Kind, ReactNode> = {
    list: <path d="M4 6h16M4 12h16M4 18h10" />,
    person: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20c1.2-3.6 4-5.5 7-5.5s5.8 1.9 7 5.5" /></>,
    project: <><rect x="4" y="7" width="16" height="13" rx="2" /><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></>,
  };
  return <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={`size-4 shrink-0 ${className}`}>{paths[kind]}</svg>;
}

export function useCollections() {
  const { data: lists } = useSWR<any[]>("/api/lists", fetcher);
  const { data: entities } = useSWR<any[]>("/api/entities", fetcher);
  const ready = !!lists && !!entities;
  const all: Collection[] = [
    ...(lists ?? []).map((l) => ({
      kind: "list" as const, id: l.id, name: l.name, count: l.walletCount, shared: l.visibility === "shared" || l.collaboratorCount > 0,
      isPublic: false, verified: false, canEdit: l.role !== "viewer", href: `/lists/${l.id}`, tags: l.tags ?? [],
    })),
    ...(entities ?? []).map((e) => ({
      kind: (e.type === "individual" ? "person" : "project") as Kind, id: e.id, name: e.name, count: e.walletCount, shared: false,
      isPublic: e.visibility === "public", verified: e.verification?.status === "verified", canEdit: true, href: `/entities/${e.id}`, tags: e.tags ?? [], avatarUrl: e.avatarUrl || undefined,
    })),
  ].sort((a, b) => a.name.localeCompare(b.name));
  return { all, ready };
}

/** Where a wallet already is, as collections. */
export function collectionsOf(w: any): Collection[] {
  return [
    ...(w.lists ?? []).map((l: any) => ({ kind: "list" as const, id: l.id, name: l.name, count: 0, shared: l.visibility === "shared", isPublic: false, verified: false, canEdit: true, href: `/lists/${l.id}`, tags: [] })),
    ...(w.entities ?? []).map((e: any) => ({ kind: (e.type === "individual" ? "person" : "project") as Kind, id: e.id, name: e.name, count: 0, shared: false, isPublic: e.visibility === "public", verified: e.verification?.status === "verified", canEdit: !!w.own, href: `/entities/${e.id}`, tags: [] })),
  ];
}

export async function createCollection(kind: Kind, name: string): Promise<Collection> {
  if (kind === "list") {
    const l = await api("/api/lists", { body: { name } });
    return { kind, id: l.id, name: l.name, count: 0, shared: false, isPublic: false, verified: false, canEdit: true, href: `/lists/${l.id}`, tags: [] };
  }
  const e = await api("/api/entities", { body: { name, type: kind === "person" ? "individual" : "project" } });
  return { kind, id: e.id, name: e.name, count: 0, shared: false, isPublic: false, verified: false, canEdit: true, href: `/entities/${e.id}`, tags: [] };
}

export async function resolveCollection(c: CollectionChoice): Promise<{ kind: Kind; id: string; name: string }> {
  return c.id ? { kind: c.kind, id: c.id, name: c.name } : createCollection(c.kind, c.name);
}

export function addToCollection(c: { kind: Kind; id: string }, walletId: string) {
  return c.kind === "list" ? api(`/api/lists/${c.id}/wallets`, { body: { walletId } }) : api(`/api/entities/${c.id}/wallets`, { body: { walletId } });
}
export function removeFromCollection(c: { kind: Kind; id: string }, walletId: string) {
  return c.kind === "list" ? api(`/api/lists/${c.id}/wallets?walletId=${walletId}`, { method: "DELETE" }) : api(`/api/entities/${c.id}/wallets/${walletId}`, { method: "DELETE" });
}

/** Type to find any list, person or project, or create one of any kind from what you typed. */
export function CollectionPicker({ onSelect, exclude = [], placeholder = "Find or create a list", label = "Add to list", autoFocus }: {
  onSelect: (c: CollectionChoice) => void; exclude?: string[]; placeholder?: string; label?: string; autoFocus?: boolean;
}) {
  const { all } = useCollections();
  const [text, setText] = useState(""), [open, setOpen] = useState(false), [index, setIndex] = useState(0);
  const term = text.trim().toLowerCase();
  const matches = all.filter((c) => c.canEdit && !exclude.includes(c.id) && (!term || c.name.toLowerCase().includes(term))).slice(0, 7);
  const exact = all.some((c) => c.name.toLowerCase() === term);
  const options: CollectionChoice[] = [...matches, ...(term && !exact ? KINDS.map((k) => ({ kind: k.kind, name: text.trim() })) : [])];
  const pick = (c: CollectionChoice) => { onSelect(c); setText(""); setOpen(false); setIndex(0); };
  return (
    <div className="relative">
      <input
        role="combobox" aria-label={label} aria-expanded={open && options.length > 0} aria-autocomplete="list" autoFocus={autoFocus}
        value={text} placeholder={placeholder}
        onChange={(e) => { setText(e.target.value); setOpen(true); setIndex(0); }}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setIndex((i) => Math.min(i + 1, options.length - 1)); }
          if (e.key === "ArrowUp") { e.preventDefault(); setIndex((i) => Math.max(i - 1, 0)); }
          if (e.key === "Enter" && open && options[index]) { e.preventDefault(); pick(options[index]!); }
          if (e.key === "Escape") setOpen(false);
        }}
        className="w-full rounded-md border border-line bg-card px-3 py-2 text-sm placeholder:text-muted/70"
      />
      {open && options.length > 0 && (
        <ul role="listbox" className="absolute z-40 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-line bg-card p-1 text-sm shadow-lg">
          {options.map((o, i) => (
            <li key={o.id ?? `new-${o.kind}`} role="option" aria-selected={i === index}
              onMouseDown={(e) => { e.preventDefault(); pick(o); }} onMouseEnter={() => setIndex(i)}
              className={`flex cursor-pointer items-center gap-2 rounded px-2.5 py-1.5 ${i === index ? "bg-wash" : ""}`}>
              <KindIcon kind={o.kind} className="text-muted" />
              {o.id ? <span className="truncate">{o.name}</span> : <span>New {kindLabel(o.kind).toLowerCase()} <b>“{o.name}”</b></span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function CollectionChip({ c, onRemove }: { c: { kind: Kind; name: string; id?: string; href?: string }; onRemove?: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line py-0.5 pr-1 pl-2 text-sm">
      <KindIcon kind={c.kind} className="size-3.5 text-muted" />
      {c.href ? <Link href={c.href} className="hover:underline">{c.name}</Link> : <span>{c.id ? c.name : `New: ${c.name}`}</span>}
      {onRemove && <button type="button" aria-label={`Remove from ${c.name}`} className="rounded-full px-1 text-muted hover:text-ink" onClick={onRemove}>✕</button>}
    </span>
  );
}

// ---- Creating things, from anywhere ----

type Creators = { addWallet: (prefill?: { address?: string; into?: CollectionChoice & { id: string } }) => void; newList: (kind?: Kind) => void };
const CreateContext = createContext<Creators>({ addWallet: () => {}, newList: () => {} });
export const useCreate = () => useContext(CreateContext);

export function CreateProvider({ children }: { children: ReactNode }) {
  const [wallet, setWallet] = useState<null | { address?: string; into?: CollectionChoice & { id: string } }>(null);
  const [list, setList] = useState<null | Kind>(null);
  return (
    <CreateContext.Provider value={{ addWallet: (p) => setWallet(p ?? {}), newList: (k) => setList(k ?? "list") }}>
      {children}
      <Modal open={!!wallet} onClose={() => setWallet(null)} title="Add a wallet">
        {wallet && <AddWalletForm key={wallet.address ?? ""} prefill={wallet} onDone={() => setWallet(null)} />}
      </Modal>
      <Modal open={!!list} onClose={() => setList(null)} title="New list">
        {list && <NewListForm initial={list} onDone={() => setList(null)} />}
      </Modal>
    </CreateContext.Provider>
  );
}

function AddWalletForm({ prefill, onDone }: { prefill: { address?: string; into?: CollectionChoice & { id: string } }; onDone: () => void }) {
  const { mutate } = useSWRConfig();
  const { toast } = useToast();
  const [address, setAddress] = useState(prefill.address ?? "");
  const [chain, setChain] = useState("ethereum");
  const [name, setName] = useState("");
  const [labels, setLabels] = useState<Labels>({ status: "none", tags: [] });
  const [into, setInto] = useState<CollectionChoice[]>(prefill.into ? [prefill.into] : []);
  const [error, setError] = useState(""), [addrError, setAddrError] = useState(""), [busy, setBusy] = useState(false);
  const family = inferFamily(address.trim()) ?? "evm";
  const chains = CHAIN_IDS.filter((c) => CHAINS[c].family === family);
  const chosen = chains.includes(chain as never) ? chain : chains[0]!;
  const sharedTo = into.filter((c) => c.kind === "list");

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError(""); setAddrError("");
    const parsed = parsePastedAddress(address);
    if (!parsed || parsed.kind === "ens" || parsed.kind === "sns") {
      setAddrError(/^0x[0-9a-fA-F]{40}$/.test(address.trim()) ? addressError(address.trim(), "ethereum")! : "Paste an EVM, Solana or Bitcoin address.");
      return;
    }
    setBusy(true);
    try {
      const w = await api("/api/wallets", { body: { address: parsed.raw, chain: chosen, displayLabel: name, status: labels.status, tags: labels.tags } });
      // Adding an address you already had updates it, rather than silently keeping the old name.
      if (w.existing && (name || labels.status !== "none" || labels.tags.length)) {
        await api(`/api/wallets/${w.id}`, { method: "PATCH", body: { ...(name ? { displayLabel: name } : {}), ...(labels.status !== "none" ? { status: labels.status } : {}), ...(labels.tags.length ? { tags: [...new Set([...(w.tags ?? []), ...labels.tags])] } : {}) } });
      }
      for (const c of into) await addToCollection(await resolveCollection(c), w.id);
      await mutate((k) => typeof k === "string" && k.startsWith("/api/"));
      toast(w.existing ? `You already had that wallet, so it was updated.` : `Added ${name || "the wallet"}.`);
      onDone();
    } catch (err) {
      if (err instanceof ClientError && err.data.fields?.address) setAddrError(err.data.fields.address);
      else setError((err as Error).message);
    } finally { setBusy(false); }
  }

  return (
    <form className="space-y-4" onSubmit={submit} noValidate>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Address</span>
        <input autoFocus={!prefill.address} aria-label="Address" aria-invalid={!!addrError} value={address} onChange={(e) => { setAddress(e.target.value); setAddrError(""); }}
          placeholder="0x…, Solana or Bitcoin address" spellCheck={false} autoComplete="off"
          className="addr w-full rounded-md border border-line bg-card px-3 py-2 text-sm aria-invalid:border-bad" />
        {addrError ? <span role="alert" className="block text-sm text-bad">{addrError}</span> : chains.length > 1 && (
          <span className="flex items-center gap-1 text-xs text-muted">
            Works on every EVM chain. Explorer link opens on
            <select aria-label="Chain" value={chosen} onChange={(e) => setChain(e.target.value)} className="rounded bg-transparent px-0.5 font-medium text-ink hover:bg-wash">
              {chains.map((c) => <option key={c} value={c}>{CHAINS[c].name}</option>)}
            </select>
          </span>
        )}
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Name</span>
        <input autoFocus={!!prefill.address} aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Alice's trading wallet" className="w-full rounded-md border border-line bg-card px-3 py-2 text-sm" />
      </label>
      <div className="space-y-1.5">
        <span className="text-sm font-medium">Labels <span className="font-normal text-muted">· optional</span></span>
        <LabelPicker value={labels} onChange={setLabels} />
      </div>
      <div className="space-y-1.5">
        <span className="text-sm font-medium">Lists <span className="font-normal text-muted">· optional</span></span>
        {into.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {into.map((c, i) => <CollectionChip key={`${c.kind}-${c.id ?? c.name}`} c={c} onRemove={() => setInto(into.filter((_, j) => j !== i))} />)}
          </div>
        )}
        <CollectionPicker placeholder="Add to a list, person or project" exclude={into.map((c) => c.id).filter(Boolean) as string[]} onSelect={(c) => setInto([...into, c])} />
        <p className="text-xs text-muted">{sharedTo.length ? "People on shared lists will see its name, labels and notes." : "Private to you. A wallet doesn't have to be in a list."}</p>
      </div>
      <ErrorNote>{error}</ErrorNote>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={busy || !address.trim()}>{busy ? "Adding…" : "Add wallet"}</Button>
        <Button onClick={onDone}>Cancel</Button>
      </div>
    </form>
  );
}

function NewListForm({ initial, onDone }: { initial: Kind; onDone: () => void }) {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const [kind, setKind] = useState<Kind>(initial), [name, setName] = useState(""), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const placeholders: Record<Kind, string> = { list: "Research, Watchlist, Team treasury…", person: "Alice, vitalik.eth…", project: "Uniswap, Binance, Lido DAO…" };
  return (
    <form className="space-y-4" onSubmit={async (e) => {
      e.preventDefault(); setError(""); setBusy(true);
      try {
        const c = await createCollection(kind, name.trim());
        await mutate((k) => typeof k === "string" && k.startsWith("/api/"));
        onDone();
        router.push(c.href);
      } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
    }}>
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">What is it?</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {KINDS.map((k) => (
            <label key={k.kind} className={`flex cursor-pointer flex-col gap-1 rounded-lg border p-3 text-sm ${kind === k.kind ? "border-accent bg-accent/5" : "border-line hover:bg-wash"}`}>
              <input type="radio" name="kind" value={k.kind} checked={kind === k.kind} onChange={() => setKind(k.kind)} className="sr-only" />
              <span className="flex items-center gap-2 font-medium"><KindIcon kind={k.kind} />{k.label}</span>
              <span className="text-xs text-muted">{k.hint}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Name</span>
        <input autoFocus required aria-label="Name" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder={placeholders[kind]} className="w-full rounded-md border border-line bg-card px-3 py-2 text-sm" />
      </label>
      <ErrorNote>{error}</ErrorNote>
      <Button type="submit" variant="primary" disabled={busy || !name.trim()}>{busy ? "Creating…" : `Create ${kindLabel(kind).toLowerCase()}`}</Button>
    </form>
  );
}
