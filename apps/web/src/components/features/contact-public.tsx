"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { ENTITY_TYPES } from "@tagawallet/shared";
import { api, fetcher } from "@/lib/client";
import { Address, Button, ErrorNote, Select } from "@/components/ui";
import { LinkEditor, type LinkRow } from "@/components/link-editor";
import { AutoField, TagInput } from "@/components/kit";
import { relationshipLabel } from "@/components/collections";

/**
 * Making a contact public: choose which wallets appear, then publish.
 * Publishing shares your names for these wallets, shown as published by you. It isn't a claim that they're yours,
 * so there's nothing to verify. Shared by the contact page and home.
 */

/** Who things you publish show as, and where your public profile is. */
export function usePublisher() {
  const { data } = useSWR("/api/auth/session", fetcher);
  const u = data?.user;
  return { name: (u?.displayName as string) ?? "you", profile: u?.profilePublic && u?.handle ? `/u/${u.handle}` : null };
}

/** Says who it will show as published by, and links your public profile (or where to turn it on). */
export function PublishedAs() {
  const me = usePublisher();
  return (
    <p className="text-xs text-pretty text-muted">
      Shows as published by <b className="font-medium text-ink">{me.name}</b>.{" "}
      {me.profile ? <>It also appears on <Link className="underline" href={me.profile} target="_blank">your public profile</Link>.</> : <>Turn on <Link className="underline" href="/settings#profile">your public profile</Link> to list everything you publish in one place.</>}
    </p>
  );
}

function Publish({ entity, onDone }: { entity: any; onDone: () => void }) {
  const [ack, setAck] = useState(false), [figure, setFigure] = useState(false), [index, setIndex] = useState(false), [error, setError] = useState("");
  const person = entity.type === "individual" && entity.verification?.status !== "verified";
  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted">Its name, description, links, labels and the wallets you ticked become public. Your notes never do.</p>
      <label className="flex gap-2"><input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} /> I&apos;m sharing my names for these wallets publicly, and the profile has no one&apos;s private personal information.</label>
      {person && <label className="flex gap-2"><input type="checkbox" checked={figure} onChange={(e) => setFigure(e.target.checked)} /> This is a public figure, and these wallets are already publicly known to be theirs.</label>}
      <label className="flex gap-2"><input type="checkbox" checked={index} onChange={(e) => setIndex(e.target.checked)} /> Let search engines show it.</label>
      <ErrorNote>{error}</ErrorNote>
      <Button variant="primary" disabled={!ack || (person && !figure)} onClick={async () => {
        setError("");
        try { await api(`/api/entities/${entity.id}/publish`, { body: { publish: true, acknowledge: ack, allowIndexing: index, ...(person ? { publicFigure: figure } : {}) } }); onDone(); }
        catch (e) { setError((e as Error).message); }
      }}>Make public</Button>
    </div>
  );
}

export const entityTypeLabel = (s: string) => s === "dao" ? "DAO" : (s[0]!.toUpperCase() + s.slice(1)).replace("_", " ");

export type ContactProps = { e: any; id: string; mutate: () => Promise<unknown> };

export function ContactAbout({ e, id, mutate, bare }: ContactProps & { bare?: boolean }) {
  const [links, setLinks] = useState<LinkRow[]>(e.links ?? []);
  const [problem, setProblem] = useState("");
  const save = async (body: object) => {
    setProblem("");
    try { await api(`/api/entities/${id}`, { method: "PATCH", body }); await mutate(); }
    catch (err) { setProblem((err as Error).message); throw err; }
  };
  return (
    <section aria-labelledby={bare ? undefined : "about-h"} aria-label={bare ? "About" : undefined} className={bare ? "space-y-4" : "h-fit space-y-4 rounded-2xl bg-card p-4"}>
      {!bare && <h2 id="about-h" className="px-2 font-semibold">About</h2>}
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
              {ENTITY_TYPES.map((t) => <option key={t} value={t}>{entityTypeLabel(t)}</option>)}
            </Select>
          </label>
          <AutoField label="Logo URL" value={e.avatarUrl ?? ""} placeholder="https://…" onSave={(avatarUrl) => save({ avatarUrl })} />
        </div>
      </details>
      <ErrorNote>{problem}</ErrorNote>
    </section>
  );
}

export function Step({ n, title, done, children }: { n: number; title: string; done: boolean; children: React.ReactNode }) {
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


export function PublicSetup({ e, id, mutate }: ContactProps) {
  const [error, setError] = useState("");
  const isPublic = e.visibility === "public";
  const shown = e.wallets.filter((w: any) => w.linkVisibility === "public").length;
  const setVisibility = async (w: any, on: boolean) => {
    setError("");
    try { await api(`/api/entities/${id}/wallets`, { body: { walletId: w.id, relationship: w.relationship, visibility: on ? "public" : "private" } }); await mutate(); }
    catch (err) { setError((err as Error).message); }
  };
  return (
    <ol className="max-w-2xl space-y-3">
      <Step n={1} title="Choose which wallets appear" done={shown > 0}>
        {e.wallets.length ? (
          <ul className="divide-y divide-line">
            {e.wallets.map((w: any) => (
              <li key={w.id} className="py-2">
                <label className="flex min-w-0 items-center gap-2">
                  <input type="checkbox" checked={w.linkVisibility === "public"} onChange={(ev) => void setVisibility(w, ev.target.checked)} />
                  <span className="truncate">{w.displayLabel || <Address value={w.address} />}</span>
                  <span className="text-xs text-muted">{relationshipLabel(w.relationship)}</span>
                </label>
              </li>
            ))}
          </ul>
        ) : <p className="text-muted">Add wallets to this contact first.</p>}
        <ErrorNote>{error}</ErrorNote>
        <p className="mt-2 text-xs text-muted">Unticked wallets stay private.</p>
      </Step>
      <Step n={2} title={isPublic ? "Public" : "Make it public"} done={isPublic}>
        {isPublic ? (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/p/${e.slug}`} target="_blank" className="underline">tagawallet.com/p/{e.slug}</Link>
              <Button className="ml-auto" onClick={async () => { await api(`/api/entities/${id}/publish`, { body: { publish: false } }); await mutate(); }}>Make private</Button>
            </div>
            <PublishedAs />
          </div>
        ) : <div className="space-y-3"><Publish entity={e} onDone={() => void mutate()} /><PublishedAs /></div>}
      </Step>
    </ol>
  );
}
