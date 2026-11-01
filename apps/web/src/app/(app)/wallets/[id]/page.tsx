"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { WALLET_STATUSES } from "@tagawallet/shared";
import { api, fetcher } from "@/lib/client";
import { Address, Button, ChainName, Empty, ErrorNote, Field, Input, Select, Textarea, VerificationPill, VisibilityPill } from "@/components/ui";
import { LinkEditor, parseTags, type LinkRow } from "@/components/link-editor";

export default function WalletPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: w, error, mutate } = useSWR(`/api/wallets/${id}`, fetcher);
  const { data: entities } = useSWR<any[]>("/api/entities", fetcher);
  const [f, setF] = useState({ displayLabel: "", notes: "", tags: "", status: "none" });
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [problem, setProblem] = useState(""), [saved, setSaved] = useState(false), [entityId, setEntityId] = useState("");

  useEffect(() => {
    if (!w) return;
    setF({ displayLabel: w.displayLabel, notes: w.notes, tags: (w.tags ?? []).join(", "), status: w.status });
    setLinks(w.links ?? []);
  }, [w?.id]); // eslint-disable-line

  if (error) return <Empty title="Wallet not found">It may have been deleted, or you may not have access.</Empty>;
  if (!w) return <p className="text-sm text-muted">Loading…</p>;

  async function save(e: React.FormEvent) {
    e.preventDefault(); setProblem(""); setSaved(false);
    try {
      await api(`/api/wallets/${id}`, { method: "PATCH", body: { ...f, tags: parseTags(f.tags), links: links.filter((l) => l.url.trim()) } });
      setSaved(true); mutate();
    } catch (err) { setProblem((err as Error).message); }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
      <div className="space-y-5">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">{w.displayLabel || "Unnamed wallet"}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            <Address value={w.address} full /> · <ChainName chain={w.chain} />
            <button className="underline" onClick={() => navigator.clipboard.writeText(w.address)}>Copy</button>
            <a className="underline" target="_blank" rel="noreferrer noopener" href={w.explorerUrl}>Explorer</a>
          </div>
        </header>
        <form onSubmit={save} className="space-y-4 rounded-xl border border-line bg-card p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name"><Input value={f.displayLabel} onChange={(e) => setF({ ...f, displayLabel: e.target.value })} /></Field>
            <Field label="Status">
              <>
                <Input list="wallet-statuses" value={f.status === "none" ? "" : f.status} placeholder="mine, watchlist, scam, trusted, or your own" onChange={(e) => setF({ ...f, status: e.target.value.trim() || "none" })} />
                <datalist id="wallet-statuses">{WALLET_STATUSES.filter((s) => s !== "none").map((s) => <option key={s} value={s} />)}</datalist>
              </>
            </Field>
          </div>
          <Field label="Tags" hint="Separate with commas"><Input value={f.tags} onChange={(e) => setF({ ...f, tags: e.target.value })} /></Field>
          <Field label="Notes"><Textarea rows={4} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
          <div className="space-y-1.5"><span className="text-sm font-medium">Links</span><LinkEditor value={links} onChange={setLinks} /></div>
          <ErrorNote>{problem}</ErrorNote>
          <div className="flex items-center gap-3">
            <Button type="submit" variant="primary">Save changes</Button>
            {saved && <span role="status" className="text-sm text-good">Saved</span>}
          </div>
        </form>
        {w.own && (
          <Button variant="danger" onClick={async () => {
            if (confirm("Delete this wallet from your account and every list?")) { await api(`/api/wallets/${id}`, { method: "DELETE" }); router.push("/dashboard"); }
          }}>Delete wallet</Button>
        )}
      </div>
      <aside className="space-y-4">
        <section className="rounded-xl border border-line bg-card p-4">
          <h2 className="mb-2 font-semibold">In lists</h2>
          {w.lists.length ? (
            <ul className="space-y-1.5 text-sm">
              {w.lists.map((l: any) => <li key={l.id} className="flex items-center justify-between gap-2"><Link className="truncate hover:underline" href={`/lists/${l.id}`}>{l.name}</Link><VisibilityPill visibility={l.visibility} /></li>)}
            </ul>
          ) : <p className="text-sm text-muted">Not in a list.</p>}
        </section>
        <section className="rounded-xl border border-line bg-card p-4">
          <h2 className="mb-2 font-semibold">Entities</h2>
          <ul className="mb-3 space-y-2 text-sm">
            {w.entities.map((e: any) => (
              <li key={e.id} className="flex items-center justify-between gap-2">
                <Link className="truncate hover:underline" href={`/entities/${e.id}`}>{e.name}</Link><VerificationPill status={e.verification?.status} />
              </li>
            ))}
          </ul>
          {w.own && (
            <div className="flex gap-2">
              <Select aria-label="Entity" value={entityId} onChange={(e) => setEntityId(e.target.value)}>
                <option value="">Link to entity…</option>
                {entities?.filter((e) => !w.entities.some((x: any) => x.id === e.id)).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </Select>
              <Button disabled={!entityId} onClick={async () => { await api(`/api/entities/${entityId}/wallets`, { body: { walletId: id } }); setEntityId(""); mutate(); }}>Link</Button>
            </div>
          )}
        </section>
        <p className="px-1 text-xs text-muted">Source: {w.source}. Added {new Date(w.createdAt).toLocaleDateString()}.</p>
      </aside>
    </div>
  );
}
