"use client";

import { Suspense, use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";
import { CHAIN_IDS, CHAINS, ENTITY_TYPES, RELATIONSHIPS, chainFamily, inferFamily, linkHref, LINK_TYPE_LABELS, type ChainId, type LinkType } from "@tagawallet/shared";
import { api, fetcher } from "@/lib/client";
import { Address, Button, ChainName, Empty, ErrorNote, Field, Input, Modal, Pill, Select, VerificationPill } from "@/components/ui";
import { LinkEditor, type LinkRow } from "@/components/link-editor";
import { AutoField, LabelChips, Menu, menuItem, TagInput, useToast } from "@/components/kit";
import { signWithSolana } from "@/lib/solana-client";
import { WalletsView } from "@/components/wallets-view";
import { kindLabel, type Kind } from "@/components/collections";

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
async function signClaim(entityId: string, walletId: string, address: string, chain: string) {
  if (chain === "solana") {
    const v = await api(`/api/entities/${entityId}/verify`, { body: { method: "signature", target: walletId } });
    const signed = await signWithSolana(v.message);
    if (signed.address !== address) throw new Error(`Your Solana wallet is connected as a different address. Switch to ${address.slice(0, 6)}… and try again.`);
    await api(`/api/entities/${entityId}/verify`, { body: { verificationId: v.id, proof: signed.signature } });
    return;
  }
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

const label = (s: string) => s === "dao" ? "DAO" : (s[0]!.toUpperCase() + s.slice(1)).replace("_", " ");
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");

export default function EntityPage({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense><EntityInner params={params} /></Suspense>;
}

/** A contact card: who they are, the wallets that are theirs, and where to find them. Publishing is a side door. */
function EntityInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { mutate: mutateAll } = useSWRConfig();
  const { undoable } = useToast();
  const { data: e, error, mutate } = useSWR(`/api/entities/${id}`, fetcher);
  const [publishing, setPublishing] = useState(false);
  useEffect(() => { if (typeof location !== "undefined" && location.hash === "#public") setPublishing(true); }, []);

  if (error) return <Empty title="Not found">It may have been deleted, or you may not have access.</Empty>;
  if (!e) return <p className="text-sm text-muted">Loading…</p>;
  const isPublic = e.visibility === "public";
  const kind: Kind = e.type === "individual" ? "person" : "project";

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          {e.avatarUrl
            ? <img src={e.avatarUrl} alt="" className="size-14 shrink-0 rounded-full object-cover" />
            : <span aria-hidden className="grid size-14 shrink-0 place-items-center rounded-full bg-wash text-lg font-semibold text-muted">{initials(e.name)}</span>}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-semibold tracking-tight">{e.name}</h1>
              {isPublic && <><Pill tone="accent">Public</Pill><VerificationPill status={e.verification?.status} /></>}
            </div>
            <p className="text-sm text-muted">{kindLabel(kind)}{kind === "project" && !["project", "other"].includes(e.type) ? ` · ${label(e.type)}` : ""} · {e.wallets.length} wallet{e.wallets.length === 1 ? "" : "s"}{!isPublic ? " · Private to you" : ""}</p>
            {e.moderation?.removedAt && <p className="mt-1 text-sm text-bad">Moderators removed this profile from public view.</p>}
          </div>
        </div>
        {e.own && (
          <div className="flex items-center gap-2">
            {isPublic && <Link href={`/p/${e.slug}`} className="inline-flex min-h-9 items-center rounded-md border border-line bg-card px-3 text-sm font-medium hover:bg-wash">View profile ↗</Link>}
            <Button onClick={() => setPublishing(true)}>{isPublic ? "Public profile" : "Publish…"}</Button>
            <Menu label="⋯" ariaLabel="More actions">
              {(close) => (
                <>
                <a className={menuItem} href={`/api/entities/${id}/export?format=csv`} onClick={close}>Export CSV</a>
                <a className={menuItem} href={`/api/entities/${id}/export?format=json`} onClick={close}>Export JSON</a>
                <button className={`${menuItem} text-bad`} onClick={() => {
                  close();
                  void mutateAll("/api/entities", (d: any[] | undefined) => d?.filter((x) => x.id !== id), { revalidate: false });
                  router.push("/entities");
                  undoable(`Deleted “${e.name}”`, async () => { await api(`/api/entities/${id}`, { method: "DELETE" }); await mutateAll("/api/entities"); }, () => void mutateAll("/api/entities"));
                }}>Delete {e.name}</button>
                </>
              )}
            </Menu>
          </div>
        )}
      </header>

      {e.own ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
          <WalletsView scope={{ kind, id, name: e.name }} emptyHint={`Add the wallets you know are ${e.name}'s. You can also add a wallet to ${e.name} from the wallet itself.`} />
          <AboutSection e={e} id={id} mutate={mutate} />
        </div>
      ) : (
        <section className="space-y-3 rounded-2xl bg-card p-4 text-sm">
          {e.description && <p>{e.description}</p>}
          <ul className="space-y-1">{e.links?.map((l: any) => <li key={l.url}><a className="underline" rel="noreferrer noopener nofollow" target="_blank" href={linkHref(l.type, l.url)}>{l.label || LINK_TYPE_LABELS[l.type as LinkType]}</a></li>)}</ul>
          <ul className="divide-y divide-line">{e.wallets.map((w: any) => <li key={w.id} className="py-2"><Address value={w.address} /> · <ChainName chain={w.chain} /></li>)}</ul>
        </section>
      )}

      <Modal open={publishing} onClose={() => setPublishing(false)} title="Public profile">
        {publishing && (
          <div className="space-y-3">
            <p className="text-sm text-muted">Optional. A public profile lets anyone using TagAWallet recognize these wallets. Your notes and private labels never appear.</p>
            <PublicTab e={e} id={id} mutate={mutate} />
          </div>
        )}
      </Modal>
    </div>
  );
}

type TabProps = { e: any; id: string; mutate: () => Promise<unknown> };

function AboutSection({ e, id, mutate }: TabProps) {
  const [links, setLinks] = useState<LinkRow[]>(e.links ?? []);
  const [problem, setProblem] = useState("");
  const save = async (body: object) => {
    setProblem("");
    try { await api(`/api/entities/${id}`, { method: "PATCH", body }); await mutate(); }
    catch (err) { setProblem((err as Error).message); throw err; }
  };
  return (
    <section aria-labelledby="about-h" className="h-fit space-y-4 rounded-2xl bg-card p-4">
      <h2 id="about-h" className="px-2 font-semibold">About</h2>
      <AutoField label="Name" value={e.name} onSave={(name) => save({ name })} />
      <AutoField label="Notes" multiline value={e.description ?? ""} placeholder="Who they are, how you know" onSave={(description) => save({ description })} />
      <div className="space-y-1.5 px-2">
        <span className="text-xs font-medium text-muted">Labels</span>
        <TagInput label="Labels" placeholder="e.g. exchange, kol" value={e.tags ?? []} onChange={(tags) => void save({ tags }).catch(() => {})} />
      </div>
      <div className="space-y-1.5 px-2">
        <span className="text-xs font-medium text-muted">Links</span>
        <LinkEditor value={links} onChange={setLinks} onCommit={(next) => void save({ links: next.filter((l) => l.url.trim()) }).catch(() => {})} />
      </div>
      <details className="px-2">
        <summary className="cursor-pointer text-xs font-medium text-muted hover:text-ink">More</summary>
        <div className="mt-2 space-y-3">
          <label className="block">
            <span className="text-xs font-medium text-muted">Type</span>
            <Select aria-label="Type" value={e.type} onChange={(ev) => void save({ type: ev.target.value }).catch(() => {})}>
              {ENTITY_TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}
            </Select>
          </label>
          <AutoField label="Logo URL" value={e.avatarUrl ?? ""} placeholder="https://…" onSave={(avatarUrl) => save({ avatarUrl })} />
        </div>
      </details>
      <ErrorNote>{problem}</ErrorNote>
    </section>
  );
}

function Step({ n, title, done, children }: { n: number; title: string; done: boolean; children: React.ReactNode }) {
  return (
    <li className="rounded-2xl bg-card p-4">
      <h3 className="flex items-center gap-2 font-semibold">
        <span aria-hidden className={`grid size-6 place-items-center rounded-full text-xs ${done ? "bg-good text-card" : "bg-wash text-muted"}`}>{done ? "✓" : n}</span>
        {title}
      </h3>
      <div className="mt-3 pl-8 text-sm">{children}</div>
    </li>
  );
}

function PublicTab({ e, id, mutate }: TabProps) {
  const [sigError, setSigError] = useState("");
  const verified = e.verification?.status === "verified";
  const isPublic = e.visibility === "public";
  const kind: Kind = e.type === "individual" ? "person" : "project";
  const shown = e.wallets.filter((w: any) => w.linkVisibility === "public").length;
  const setVisibility = async (w: any, on: boolean) => {
    setSigError("");
    try { await api(`/api/entities/${id}/wallets`, { body: { walletId: w.id, relationship: w.relationship, visibility: on ? "public" : "private" } }); await mutate(); }
    catch (err) { setSigError((err as Error).message); }
  };
  return (
    <ol className="max-w-2xl space-y-3">
      <Step n={1} title="Verify it's you" done={verified}>
        {verified
          ? <p className="text-muted">Verified. The profile shows what was proven.</p>
          : <>
              <p className="mb-3 text-muted">{e.type === "individual" ? "Profiles of individuals must be verified before they can be public." : "Optional, but without it the profile shows as self-claimed."}</p>
              <Verify entity={e} onDone={() => void mutate()} />
            </>}
      </Step>
      <Step n={2} title="Choose which wallets appear" done={shown > 0}>
        {e.wallets.length ? (
          <ul className="divide-y divide-line">
            {e.wallets.map((w: any) => {
              const signed = w.evidence?.some((x: any) => x.verifiedAt);
              return (
                <li key={w.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <label className="flex min-w-0 items-center gap-2">
                    <input type="checkbox" checked={w.linkVisibility === "public"} onChange={(ev) => void setVisibility(w, ev.target.checked)} />
                    <span className="truncate">{w.displayLabel || <Address value={w.address} />}</span>
                  </label>
                  {signed ? <Pill tone="good">✓ Signed</Pill> : (chainFamily(w.chain as ChainId) === "evm" || w.chain === "solana") && (
                    <Button variant="ghost" onClick={async () => { setSigError(""); try { await signClaim(id, w.id, w.address, w.chain); await mutate(); } catch (err) { setSigError((err as Error).message); } }}>Prove with signature</Button>
                  )}
                </li>
              );
            })}
          </ul>
        ) : <p className="text-muted">Add wallets first, under Wallets on this page.</p>}
        <ErrorNote>{sigError}</ErrorNote>
        <p className="mt-2 text-xs text-muted">Unchecked wallets stay private. Your names, notes and private tags never appear.</p>
      </Step>
      <Step n={3} title={isPublic ? "Published" : "Publish"} done={isPublic}>
        {isPublic ? (
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/p/${e.slug}`} className="underline">tagawallet.com/p/{e.slug}</Link>
            <Button className="ml-auto" onClick={async () => { await api(`/api/entities/${id}/publish`, { body: { publish: false } }); await mutate(); }}>Make private</Button>
          </div>
        ) : <Publish entity={e} onDone={() => void mutate()} />}
      </Step>
    </ol>
  );
}
