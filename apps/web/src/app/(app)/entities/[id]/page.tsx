"use client";

import { Suspense, use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";
import { RELATIONSHIPS, linkHref, LINK_TYPE_LABELS, type LinkType, type Relationship } from "@tagawallet/shared";
import { api, fetcher } from "@/lib/client";
import { Address, Button, ChainName, Empty, Modal, Pill, Select, VerificationPill } from "@/components/ui";
import { Menu, menuItem, useToast } from "@/components/kit";
import { kindLabel, relationshipLabel, useCreate, type Kind } from "@/components/collections";
import { useOpenWallet } from "@/components/wallet-drawer";
import { ContactAbout, entityTypeLabel, PublicSetup, type ContactProps } from "@/components/features/contact-public";


const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");

export default function EntityPage({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense><EntityInner params={params} /></Suspense>;
}

/** A contact card: who they are, the addresses that are theirs, and where to find them. */
function EntityInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { mutate: mutateAll } = useSWRConfig();
  const { undoable } = useToast();
  const { addWallet } = useCreate();
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
              {isPublic
                ? <><Pill tone="accent">Public</Pill><VerificationPill status={e.verification?.status} /></>
                : <Pill>Private</Pill>}
            </div>
            <p className="text-sm text-muted">{kindLabel(kind)}{kind === "project" && !["project", "other"].includes(e.type) ? ` · ${entityTypeLabel(e.type)}` : ""} · {e.wallets.length} address{e.wallets.length === 1 ? "" : "es"}</p>
            {e.moderation?.removedAt && <p className="mt-1 text-sm text-bad">Moderators removed this profile from public view.</p>}
          </div>
        </div>
        {e.own && (
          <div className="flex items-center gap-2">
            {isPublic && <Link href={`/p/${e.slug}`} className="inline-flex min-h-9 items-center rounded-md border border-line bg-card px-3 text-sm font-medium hover:bg-wash">View profile ↗</Link>}
            <Button onClick={() => setPublishing(true)}>{isPublic ? "Public" : "Make public…"}</Button>
            <Menu label="⋯" ariaLabel="More actions">
              {(close) => (
                <>
                <a className={menuItem} href={`/api/entities/${id}/export?format=csv`} onClick={close}>Export CSV</a>
                <a className={menuItem} href={`/api/entities/${id}/export?format=json`} onClick={close}>Export JSON</a>
                <button className={`${menuItem} text-bad`} onClick={() => {
                  close();
                  void mutateAll("/api/entities", (d: any[] | undefined) => d?.filter((x) => x.id !== id), { revalidate: false });
                  router.push("/dashboard");
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
          <AddressesSection e={e} id={id} kind={kind} mutate={mutate} onAdd={() => addWallet({ into: { kind, id, name: e.name } })} />
          <ContactAbout e={e} id={id} mutate={mutate} />
        </div>
      ) : (
        <section className="space-y-3 rounded-2xl bg-card p-4 text-sm">
          {e.description && <p>{e.description}</p>}
          <ul className="space-y-1">{e.links?.map((l: any) => <li key={l.url}><a className="underline" rel="noreferrer noopener nofollow" target="_blank" href={linkHref(l.type, l.url)}>{l.label || LINK_TYPE_LABELS[l.type as LinkType]}</a></li>)}</ul>
          <ul className="divide-y divide-line">
            {e.wallets.map((w: any) => (
              <li key={w.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span><Address value={w.address} /> · <ChainName chain={w.chain} /></span>
                <span className="text-xs text-muted">{relationshipLabel(w.relationship)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Modal open={publishing} onClose={() => setPublishing(false)} title="Make public">
        {publishing && (
          <div className="space-y-3">
            <p className="text-sm text-pretty text-muted">Share your names for these wallets with everyone, shown as published by you. It isn&apos;t a claim that they&apos;re yours. Your notes never appear.</p>
            <PublicSetup e={e} id={id} mutate={mutate} />
          </div>
        )}
      </Modal>
    </div>
  );
}

type TabProps = ContactProps;

function AddressesSection({ e, id, kind, mutate, onAdd }: TabProps & { kind: Kind; onAdd: () => void }) {
  const openWallet = useOpenWallet();
  const { toast } = useToast();
  const setRole = async (w: any, relationship: Relationship) => {
    try {
      await api(`/api/entities/${id}/wallets`, { body: { walletId: w.id, relationship, visibility: w.linkVisibility ?? "private" } });
      await mutate();
    } catch (err) { toast((err as Error).message); }
  };
  const remove = async (w: any) => {
    try {
      await api(`/api/entities/${id}/wallets/${w.id}`, { method: "DELETE" });
      await mutate();
      toast(`Removed from ${e.name}.`);
    } catch (err) { toast((err as Error).message); }
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Addresses</h2>
        <Button variant="primary" onClick={onAdd}>Add address</Button>
      </div>
      {e.wallets.length ? (
        <ul className="overflow-hidden rounded-2xl bg-card divide-y divide-line">
          {e.wallets.map((w: any) => (
            <li key={w.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <button type="button" className="min-w-0 flex-1 basis-48 text-left" onClick={() => openWallet(w.id)}>
                <span className="block truncate font-medium">{w.displayLabel || <span className="text-muted">Unnamed address</span>}</span>
                <span className="flex flex-wrap items-center gap-x-1 text-xs text-muted">
                  <Address value={w.address} /> · <ChainName chain={w.chain} />
                </span>
              </button>
              <Select aria-label={`Role for ${w.displayLabel || w.address}`} className="w-auto" value={w.relationship ?? "associated"}
                onChange={(ev) => void setRole(w, ev.target.value as Relationship)}>
                {RELATIONSHIPS.map((r) => <option key={r} value={r}>{relationshipLabel(r)}</option>)}
              </Select>
              <button type="button" className="text-xs text-muted hover:text-bad" onClick={() => void remove(w)}>Remove</button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-2xl bg-card px-6 py-10 text-center">
          <p className="font-medium">No addresses yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">Add the wallets you know are {e.name}&apos;s. Each one gets a role such as treasury or hot wallet.</p>
          <Button variant="primary" className="mt-4" onClick={onAdd}>Add address</Button>
        </div>
      )}
    </section>
  );
}

