"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { CHAIN_IDS, CHAINS, ENTITY_TYPES, RELATIONSHIPS, chainFamily, linkHref, LINK_TYPE_LABELS, type ChainId, type LinkType } from "@tagawallet/shared";
import { api, fetcher } from "@/lib/client";
import { Address, Button, ChainName, Empty, ErrorNote, Field, Input, Modal, Pill, Select, Textarea, VerificationPill, VisibilityPill } from "@/components/ui";
import { LinkEditor, parseTags, type LinkRow } from "@/components/link-editor";

function AddWallet({ entityId, onDone }: { entityId: string; onDone: () => void }) {
  const [address, setAddress] = useState(""), [chain, setChain] = useState("ethereum"), [error, setError] = useState("");
  return (
    <form className="flex flex-wrap gap-2" onSubmit={async (e) => {
      e.preventDefault(); setError("");
      try { await api("/api/wallets", { body: { address, chain, entityId } }); setAddress(""); onDone(); }
      catch (err) { setError((err as Error).message); }
    }}>
      <Input className="addr min-w-0 flex-1 basis-64" aria-label="Wallet address" placeholder="Add a wallet by address" value={address} onChange={(e) => setAddress(e.target.value)} spellCheck={false} />
      <Select aria-label="Chain" className="w-auto" value={chain} onChange={(e) => setChain(e.target.value)}>
        {CHAIN_IDS.map((c) => <option key={c} value={c}>{CHAINS[c].name}</option>)}
      </Select>
      <Button type="submit" disabled={!address}>Link wallet</Button>
      {error && <div className="basis-full"><ErrorNote>{error}</ErrorNote></div>}
    </form>
  );
}

const METHODS = [
  { id: "x_post", label: "X post", target: "The X account on this profile, e.g. https://x.com/uniswap" },
  { id: "dns", label: "DNS TXT record", target: "The website on this profile, e.g. https://uniswap.org" },
  { id: "meta", label: "Website meta tag", target: "The website on this profile, e.g. https://uniswap.org" },
  { id: "ens", label: "ENS text record", target: "The ENS name on this profile, e.g. uniswap.eth" },
];

function Verify({ entity, onDone }: { entity: any; onDone: () => void }) {
  const [method, setMethod] = useState("x_post"), [target, setTarget] = useState(""), [pending, setPending] = useState<any>(null);
  const [proof, setProof] = useState(""), [error, setError] = useState(""), [done, setDone] = useState(false), [busy, setBusy] = useState(false);
  const hint = METHODS.find((m) => m.id === method)!.target;
  async function start() {
    setError("");
    try { setPending(await api(`/api/entities/${entity.id}/verify`, { body: { method, target } })); }
    catch (e) { setError((e as Error).message); }
  }
  async function check() {
    setError(""); setBusy(true);
    try { await api(`/api/entities/${entity.id}/verify`, { body: { verificationId: pending.id, proof: proof || undefined } }); setDone(true); onDone(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  if (done) return <p role="status" className="text-sm text-good">Verified. The profile now shows what was proven.</p>;
  if (pending) {
    return (
      <div className="space-y-3">
        <p className="break-words rounded-md bg-wash p-3 text-sm">{pending.instructions}</p>
        {pending.method === "x_post" && <Field label="Post URL"><Input value={proof} placeholder="https://x.com/you/status/…" onChange={(e) => setProof(e.target.value)} /></Field>}
        <ErrorNote>{error}</ErrorNote>
        <div className="flex gap-2">
          <Button variant="primary" onClick={check} disabled={busy}>{busy ? "Checking…" : "Check now"}</Button>
          <Button variant="ghost" onClick={() => setPending(null)}>Back</Button>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <Field label="Method">
        <Select value={method} onChange={(e) => setMethod(e.target.value)}>{METHODS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</Select>
      </Field>
      <Field label="What are you proving control of?" hint={hint}><Input value={target} onChange={(e) => setTarget(e.target.value)} /></Field>
      <ErrorNote>{error}</ErrorNote>
      <Button variant="primary" disabled={!target} onClick={start}>Get verification code</Button>
    </div>
  );
}

/** Asks an injected wallet to sign one message. We never request accounts beyond this or send transactions. */
async function signClaim(entityId: string, walletId: string, address: string) {
  const eth = (window as any).ethereum;
  if (!eth) throw new Error("No browser wallet found. Install one to sign, or use another method.");
  const v = await api(`/api/entities/${entityId}/verify`, { body: { method: "signature", target: walletId } });
  await eth.request({ method: "eth_requestAccounts" });
  const signature = await eth.request({ method: "personal_sign", params: [v.message, address] });
  await api(`/api/entities/${entityId}/verify`, { body: { verificationId: v.id, proof: signature } });
}

function Publish({ entity, onDone }: { entity: any; onDone: () => void }) {
  const [ack, setAck] = useState(false), [index, setIndex] = useState(false), [error, setError] = useState("");
  const blocked = entity.type === "individual" && entity.verification?.status !== "verified";
  return (
    <div className="space-y-3 text-sm">
      {entity.verification?.status !== "verified" && !blocked && <p className="rounded-md bg-warn/10 p-3">This will show as <b>self-claimed</b> until you complete a verification.</p>}
      {blocked && <p className="rounded-md bg-bad/10 p-3 text-bad">Profiles of individuals must be verified before they can be public.</p>}
      <p className="text-muted">Only the name, description, links, tags and wallets you set to public appear. Your notes and private labels never do.</p>
      <label className="flex gap-2"><input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} /> This identity is mine to claim, and the profile contains no one&apos;s private personal information.</label>
      <label className="flex gap-2"><input type="checkbox" checked={index} onChange={(e) => setIndex(e.target.checked)} /> Allow search engines to index this profile.</label>
      <ErrorNote>{error}</ErrorNote>
      <Button variant="primary" disabled={!ack || blocked} onClick={async () => {
        try { await api(`/api/entities/${entity.id}/publish`, { body: { publish: true, acknowledge: ack, allowIndexing: index } }); onDone(); }
        catch (e) { setError((e as Error).message); }
      }}>Publish profile</Button>
    </div>
  );
}

export default function EntityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: e, error, mutate } = useSWR(`/api/entities/${id}`, fetcher);
  const [f, setF] = useState({ name: "", type: "other", description: "", avatarUrl: "", tags: "" });
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [problem, setProblem] = useState(""), [saved, setSaved] = useState(false), [dialog, setDialog] = useState<null | "verify" | "publish">(null), [sigError, setSigError] = useState("");

  useEffect(() => {
    if (!e) return;
    setF({ name: e.name, type: e.type, description: e.description ?? "", avatarUrl: e.avatarUrl ?? "", tags: (e.tags ?? []).join(", ") });
    setLinks(e.links ?? []);
  }, [e?.id]); // eslint-disable-line

  if (error) return <Empty title="Entity not found">It may have been deleted, or you may not have access.</Empty>;
  if (!e) return <p className="text-sm text-muted">Loading…</p>;

  async function save(ev: React.FormEvent) {
    ev.preventDefault(); setProblem(""); setSaved(false);
    try {
      await api(`/api/entities/${id}`, { method: "PATCH", body: { ...f, tags: parseTags(f.tags), links: links.filter((l) => l.url.trim()) } });
      setSaved(true); mutate();
    } catch (err) { setProblem((err as Error).message); }
  }
  const setLink = async (w: any, patch: object) => {
    setSigError("");
    try { await api(`/api/entities/${id}/wallets`, { body: { walletId: w.id, relationship: w.relationship, visibility: w.linkVisibility, ...patch } }); mutate(); }
    catch (err) { setSigError((err as Error).message); }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{e.name}</h1>
            <VisibilityPill visibility={e.visibility} /><VerificationPill status={e.verification?.status} />
          </div>
          <p className="mt-1 text-sm capitalize text-muted">{e.type}</p>
          {e.moderation?.removedAt && <p className="mt-2 text-sm text-bad">Moderators removed this profile from public view.</p>}
        </div>
        {e.own && (
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setDialog("verify")}>Verify</Button>
            {e.visibility === "public" ? (
              <>
                <Link href={`/p/${e.slug}`} className="inline-flex min-h-9 items-center rounded-md border border-line bg-card px-3 text-sm font-medium hover:bg-wash">View profile</Link>
                <Button onClick={async () => { await api(`/api/entities/${id}/publish`, { body: { publish: false } }); mutate(); }}>Make private</Button>
              </>
            ) : <Button variant="primary" onClick={() => setDialog("publish")}>Publish…</Button>}
          </div>
        )}
      </header>

      <section className="space-y-3">
        <h2 className="font-semibold">Wallets <span className="font-normal text-muted">{e.wallets.length}</span></h2>
        {e.wallets.length > 0 && (
          <ul className="divide-y divide-line rounded-xl border border-line bg-card">
            {e.wallets.map((w: any) => (
              <li key={w.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                <div className="min-w-0 flex-1 basis-52">
                  <Link href={`/wallets/${w.id}`} className="block truncate font-medium hover:underline">{w.displayLabel || <Address value={w.address} />}</Link>
                  <div className="text-xs text-muted"><Address value={w.address} /> · <ChainName chain={w.chain} /></div>
                </div>
                {w.evidence?.some((x: any) => x.verifiedAt) && <Pill tone="good">✓ Signed</Pill>}
                {e.own && (
                  <span className="flex flex-wrap items-center gap-2">
                    <Select aria-label="Relationship" className="w-auto" value={w.relationship} onChange={(ev) => setLink(w, { relationship: ev.target.value })}>
                      {RELATIONSHIPS.map((r) => <option key={r} value={r}>{r.replace("_", " ")}</option>)}
                    </Select>
                    <Select aria-label="Link visibility" className="w-auto" value={w.linkVisibility} onChange={(ev) => setLink(w, { visibility: ev.target.value })}>
                      <option value="private">Private link</option><option value="shared">Shared link</option><option value="public">Public link</option>
                    </Select>
                    {chainFamily(w.chain as ChainId) === "evm" && !w.evidence?.some((x: any) => x.verifiedAt) && (
                      <Button variant="ghost" onClick={async () => { setSigError(""); try { await signClaim(id, w.id, w.address); mutate(); } catch (err) { setSigError((err as Error).message); } }}>Prove with signature</Button>
                    )}
                    <Button variant="ghost" onClick={async () => { await api(`/api/entities/${id}/wallets/${w.id}`, { method: "DELETE" }); mutate(); }}>Unlink</Button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        <ErrorNote>{sigError}</ErrorNote>
        {e.own && <AddWallet entityId={id} onDone={() => mutate()} />}
      </section>

      {e.own ? (
        <form onSubmit={save} className="space-y-4 rounded-xl border border-line bg-card p-4">
          <h2 className="font-semibold">Details</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name"><Input required value={f.name} onChange={(ev) => setF({ ...f, name: ev.target.value })} /></Field>
            <Field label="Type"><Select value={f.type} onChange={(ev) => setF({ ...f, type: ev.target.value })}>{ENTITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</Select></Field>
          </div>
          <Field label="Description"><Textarea rows={3} value={f.description} onChange={(ev) => setF({ ...f, description: ev.target.value })} /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Logo URL" hint="An https image link"><Input value={f.avatarUrl} onChange={(ev) => setF({ ...f, avatarUrl: ev.target.value })} /></Field>
            <Field label="Tags" hint="Separate with commas"><Input value={f.tags} onChange={(ev) => setF({ ...f, tags: ev.target.value })} /></Field>
          </div>
          <div className="space-y-1.5"><span className="text-sm font-medium">Links</span><LinkEditor value={links} onChange={setLinks} /></div>
          <ErrorNote>{problem}</ErrorNote>
          <div className="flex items-center gap-3">
            <Button type="submit" variant="primary">Save changes</Button>
            {saved && <span role="status" className="text-sm text-good">Saved</span>}
            <Button variant="danger" className="ml-auto" onClick={async () => {
              if (confirm(`Delete “${e.name}”? Its wallets stay in your account.`)) { await api(`/api/entities/${id}`, { method: "DELETE" }); router.push("/entities"); }
            }}>Delete entity</Button>
          </div>
        </form>
      ) : (
        <section className="rounded-xl border border-line bg-card p-4 text-sm">
          {e.description && <p className="mb-2">{e.description}</p>}
          <ul className="space-y-1">{e.links?.map((l: any) => <li key={l.url}><a className="underline" rel="noreferrer noopener nofollow" target="_blank" href={linkHref(l.type, l.url)}>{l.label || LINK_TYPE_LABELS[l.type as LinkType]}</a></li>)}</ul>
        </section>
      )}
      <Modal open={dialog === "verify"} onClose={() => setDialog(null)} title="Verify this entity">{dialog === "verify" && <Verify entity={e} onDone={() => mutate()} />}</Modal>
      <Modal open={dialog === "publish"} onClose={() => setDialog(null)} title="Publish a public profile">{dialog === "publish" && <Publish entity={e} onDone={() => { setDialog(null); mutate(); }} />}</Modal>
    </div>
  );
}
