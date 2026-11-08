"use client";

import Link from "next/link";
import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { api, fetcher } from "@/lib/client";
import { Button, ErrorNote, Field, Input, Modal, Textarea } from "@/components/ui";
import { Menu, menuItem, useToast } from "@/components/kit";
import type { Collection } from "@/components/collections";
import { ContactAbout, PublicSetup } from "@/components/features/contact-public";
import { ListActivity, ListPublic, SharePanel } from "@/components/features/list-sharing";
import { initials } from "../shared";
import { Icon, press } from "./ui";

/** What a selected contact or list can do beyond its wallets: the main actions as header buttons, dialogs for the rest. */

type Go = (target: { kind: Collection["kind"]; id: string } | null) => void;
type Dialog = null | "public" | "listPublic" | "about" | "share" | "activity" | "rename" | "delete";

const chip = `inline-flex h-8 items-center gap-1.5 rounded-full bg-card px-3 text-sm font-medium hover:bg-wash ${press}`;

/** The selected contact or list, loaded in full, and a way to refresh it and everything that shows it. */
export function useScope(c: Collection) {
  const key = c.kind === "list" ? `/api/lists/${c.id}` : `/api/entities/${c.id}`;
  const { data, mutate } = useSWR(key, fetcher);
  const { mutate: mutateAll } = useSWRConfig();
  const refresh = async () => { await mutate(); await mutateAll(c.kind === "list" ? "/api/lists" : "/api/entities"); };
  return { data, refresh };
}

function Avatars({ names, max = 4 }: { names: string[]; max?: number }) {
  return (
    <span className="flex -space-x-1.5" aria-label={names.join(", ")}>
      {names.slice(0, max).map((n, i) => (
        <span key={i} aria-hidden title={n} className="grid size-6 place-items-center rounded-full bg-wash text-[10px] font-semibold text-muted ring-2 ring-paper">{initials(n) || "?"}</span>
      ))}
      {names.length > max && <span aria-hidden className="grid size-6 place-items-center rounded-full bg-wash text-[10px] font-semibold text-muted ring-2 ring-paper">+{names.length - max}</span>}
    </span>
  );
}
const people = (l: any): string[] => [l.owner?.name, ...(l.collaborators ?? []).map((x: any) => x.name)].filter(Boolean);

function RenameForm({ list, onDone }: { list: any; onDone: () => void }) {
  const [form, setForm] = useState({ name: list.name, description: list.description ?? "" });
  const [error, setError] = useState("");
  return (
    <form className="space-y-3" onSubmit={async (e) => {
      e.preventDefault(); setError("");
      try { await api(`/api/lists/${list.id}`, { method: "PATCH", body: form }); onDone(); } catch (err) { setError((err as Error).message); }
    }}>
      <Field label="Name"><Input required maxLength={80} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
      <Field label="Description"><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
      <ErrorNote>{error}</ErrorNote>
      <Button type="submit" variant="primary">Save</Button>
    </form>
  );
}

/** Every dialog the header actions can open, in one place. */
function Dialogs({ c, data, refresh, dialog, setDialog, go }: { c: Collection; data: any; refresh: () => Promise<void>; dialog: Dialog; setDialog: (d: Dialog) => void; go: Go }) {
  const { mutate: mutateAll } = useSWRConfig();
  const close = () => setDialog(null);
  if (!data) return null;
  return (
    <>
      <Modal open={dialog === "public"} onClose={close} title={`Make “${c.name}” public`}>
        {dialog === "public" && <div className="space-y-3"><p className="text-sm text-pretty text-muted">Share your names for these wallets with everyone, shown as published by you. It isn&apos;t a claim that they&apos;re yours. Your notes never appear.</p><PublicSetup e={data} id={c.id} mutate={refresh} /></div>}
      </Modal>
      <Modal open={dialog === "listPublic"} onClose={close} title={`Make “${c.name}” public`}>{dialog === "listPublic" && <ListPublic list={data} onChange={() => void refresh()} />}</Modal>
      <Modal open={dialog === "about"} onClose={close} title={`About ${c.name}`}>{dialog === "about" && <ContactAbout bare e={data} id={c.id} mutate={refresh} />}</Modal>
      <Modal open={dialog === "share"} onClose={close} title={`Share “${c.name}”`}>{dialog === "share" && <SharePanel list={data} onChange={() => void refresh()} />}</Modal>
      <Modal open={dialog === "activity"} onClose={close} title={`Activity in ${c.name}`}>{dialog === "activity" && <ListActivity id={c.id} />}</Modal>
      <Modal open={dialog === "rename"} onClose={close} title="Rename list">{dialog === "rename" && <RenameForm list={data} onDone={() => { close(); void refresh(); }} />}</Modal>
      <Modal open={dialog === "delete"} onClose={close} title={`Delete “${c.name}”?`}>
        <p className="mb-4 text-sm text-pretty text-muted">The list goes away for everyone on it. Its wallets stay in your account and in your other lists.</p>
        <Button variant="danger" onClick={async () => { await api(`/api/lists/${c.id}`, { method: "DELETE" }); close(); go(null); await mutateAll("/api/lists"); }}>Delete list</Button>
      </Modal>
    </>
  );
}

/** The More menu: everything that isn't a main action. */
function MoreMenu({ c, data, refresh, setDialog, go }: { c: Collection; data: any; refresh: () => Promise<void>; setDialog: (d: Dialog) => void; go: Go }) {
  const { mutate: mutateAll } = useSWRConfig();
  const { undoable, toast } = useToast();
  const list = c.kind === "list";
  const base = list ? `/api/lists/${c.id}` : `/api/entities/${c.id}`;
  return (
    <Menu label={<><span>More</span><Icon name="chevronDown" className="size-3.5" /></>} ariaLabel={`More for ${c.name}`} buttonClass={`inline-flex h-8 items-center gap-1 rounded-full bg-card px-3 text-sm font-medium text-ink hover:bg-wash ${press}`}>
      {(close) => (
        <>
          {list ? (
            <>
              {c.canEdit && <button className={menuItem} onClick={() => { close(); setDialog("rename"); }}>Rename…</button>}
              <button className={menuItem} onClick={async () => { close(); const n = await api(`${base}/duplicate`, { method: "POST" }); await mutateAll("/api/lists"); toast(`Made a private copy.`); go({ kind: "list", id: n.id }); }}>Duplicate</button>
              {c.canEdit && <button className={menuItem} onClick={async () => { close(); await api(base, { method: "PATCH", body: { archived: !data?.archivedAt } }); await refresh(); }}>{data?.archivedAt ? "Unarchive" : "Archive"}</button>}
            </>
          ) : (
            <>
              <button className={menuItem} onClick={() => { close(); setDialog("about"); }}>Edit details…</button>
              {data?.visibility === "public" && data.slug && <Link className={menuItem} href={`/p/${data.slug}`} target="_blank" onClick={close}>View public page ↗</Link>}
            </>
          )}
          <a className={menuItem} href={`${base}/export?format=csv`} onClick={close}>Export CSV</a>
          <a className={menuItem} href={`${base}/export?format=json`} onClick={close}>Export JSON</a>
          <Link className={menuItem} href={c.href} onClick={close}>Open full page</Link>
          <div className="my-1 border-t border-line" />
          {list
            ? data?.role === "owner" && <button className={`${menuItem} text-bad`} onClick={() => { close(); setDialog("delete"); }}>Delete list…</button>
            : <button className={`${menuItem} text-bad`} onClick={() => {
                close(); go(null);
                void mutateAll("/api/entities", (d: any[] | undefined) => d?.filter((x) => x.id !== c.id), { revalidate: false });
                undoable(`Deleted “${c.name}”`, async () => { await api(base, { method: "DELETE" }); await mutateAll("/api/entities"); }, () => void mutateAll("/api/entities"));
              }}>Delete {c.name}</button>}
        </>
      )}
    </Menu>
  );
}

export function ScopeActions({ c, go, hidden }: { c: Collection; go: Go; hidden?: boolean }) {
  const { data, refresh } = useScope(c);
  const [dialog, setDialog] = useState<Dialog>(null);
  const list = c.kind === "list";
  const names = data && list ? people(data) : [];
  return (
    <span className={`flex items-center gap-2 ${hidden ? "invisible" : ""}`} aria-hidden={hidden || undefined}>
      {list ? (
        <>
          <button className={chip} onClick={() => setDialog("activity")}>Activity</button>
          {data?.role !== "viewer" || names.length > 1
            ? <button className={chip} onClick={() => setDialog("share")}>{names.length > 1 ? <><Avatars names={names} max={3} /><span>Shared</span></> : "Share"}</button>
            : null}
          {(data?.role === "owner" || data?.publishedAt) && (
            <button className={chip} onClick={() => setDialog("listPublic")}>
              {data?.publishedAt ? <><span aria-hidden className="text-accent">◎</span>Public</> : <><span aria-hidden className="text-muted">○</span>Make public…</>}
            </button>
          )}
        </>
      ) : (
        <button className={chip} onClick={() => setDialog("public")}>
          {c.isPublic
            ? <><span aria-hidden className={c.verified ? "text-good" : "text-accent"}>{c.verified ? "✓" : "◎"}</span>{c.verified ? "Public · Verified" : "Public"}</>
            : <><span aria-hidden className="text-muted">○</span>Make public…</>}
        </button>
      )}
      <MoreMenu c={c} data={data} refresh={refresh} setDialog={setDialog} go={go} />
      <Dialogs c={c} data={data} refresh={refresh} dialog={dialog} setDialog={setDialog} go={go} />
    </span>
  );
}
