"use client";

import { Suspense, use, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";
import { api, fetcher } from "@/lib/client";
import { Button, Empty, Field, Input, Modal, Textarea, VisibilityPill } from "@/components/ui";
import { WalletsView } from "@/components/wallets-view";
import { Menu, menuItem } from "@/components/kit";
import { KindIcon } from "@/components/collections";
import { ImportDialog } from "@/components/import-dialog";
import { ListActivity, ListPublic, SharePanel } from "@/components/features/list-sharing";


export default function ListPage({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense><ListInner params={params} /></Suspense>;
}

function ListInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { mutate: mutateAll } = useSWRConfig();
  const { data: list, error, mutate } = useSWR(`/api/lists/${id}`, fetcher);
  const [dialog, setDialog] = useState<null | "import" | "share" | "edit" | "delete" | "activity" | "public">(null);
  // Right after creating a list, the next step is inviting people.
  const wantsShare = useSearchParams().get("share") === "1";
  useEffect(() => { if (wantsShare) { setDialog("share"); router.replace(`/lists/${id}`, { scroll: false }); } }, [wantsShare]); // eslint-disable-line react-hooks/exhaustive-deps
  const [form, setForm] = useState({ name: "", description: "" });

  if (error) return <Empty title="List not found">It may have been deleted, or you may not have access.</Empty>;
  if (!list) return <p className="text-sm text-muted">Loading…</p>;
  const canEdit = list.role !== "viewer";
  const refreshLists = () => mutateAll("/api/lists");

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-lg bg-wash text-muted"><KindIcon kind="list" /></span>
            <h1 className="truncate text-2xl font-semibold tracking-tight">{list.name}</h1>
            <VisibilityPill visibility={list.visibility} />
            {list.archivedAt && <span className="text-sm text-muted">Archived</span>}
          </div>
          <p className="mt-1 text-sm text-muted">{list.description || (list.collaborators.length
            ? `Shared with ${list.collaborators.length} ${list.collaborators.length === 1 ? "person" : "people"}. They see the names, labels and notes of wallets here.`
            : "Not shared with anyone yet. Invite people to share these wallets with them.")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => setDialog("share")}>{list.collaborators.length ? `Shared with ${list.collaborators.length}` : "Share"}</Button>
          <Menu label="More">
            {(close) => (
              <>
                {canEdit && <button className={menuItem} onClick={() => { close(); setDialog("import"); }}>Import CSV or JSON</button>}
                <a className={menuItem} href={`/api/lists/${id}/export?format=csv`}>Export CSV</a>
                <a className={menuItem} href={`/api/lists/${id}/export?format=json`}>Export JSON</a>
                <button className={menuItem} onClick={() => { close(); setDialog("public"); }}>{list.publishedAt ? "Public…" : "Make public…"}</button>
                <button className={menuItem} onClick={() => { close(); setDialog("activity"); }}>Activity</button>
                <button className={menuItem} onClick={async () => { close(); const c = await api(`/api/lists/${id}/duplicate`, { method: "POST" }); refreshLists(); router.push(`/lists/${c.id}`); }}>Duplicate</button>
                {canEdit && <button className={menuItem} onClick={() => { close(); setForm({ name: list.name, description: list.description ?? "" }); setDialog("edit"); }}>Rename</button>}
                {canEdit && <button className={menuItem} onClick={async () => { close(); await api(`/api/lists/${id}`, { method: "PATCH", body: { archived: !list.archivedAt } }); mutate(); refreshLists(); }}>{list.archivedAt ? "Unarchive" : "Archive"}</button>}
                {list.role === "owner" && <button className={`${menuItem} text-bad`} onClick={() => { close(); setDialog("delete"); }}>Delete list</button>}
              </>
            )}
          </Menu>
        </div>
      </header>

      <Suspense>
        <WalletsView scope={{ kind: "list", id, name: list.name }} canEdit={canEdit} emptyHint={canEdit ? "Add wallets here, import a file from More, or pick this list while tagging in the extension." : "Nothing has been added yet."} />
      </Suspense>

      {dialog === "import" && <ImportDialog scope={{ kind: "list", id, name: list.name }} onClose={() => setDialog(null)} />}
      <Modal open={dialog === "share"} onClose={() => setDialog(null)} title={`Share “${list.name}”`}><SharePanel list={list} onChange={() => { mutate(); refreshLists(); }} /></Modal>
      <Modal open={dialog === "public"} onClose={() => setDialog(null)} title={`Make “${list.name}” public`}>{dialog === "public" && <ListPublic list={list} onChange={() => { mutate(); refreshLists(); }} />}</Modal>
      <Modal open={dialog === "activity"} onClose={() => setDialog(null)} title="Activity">{dialog === "activity" && <ListActivity id={id} />}</Modal>
      <Modal open={dialog === "edit"} onClose={() => setDialog(null)} title="Rename list">
        <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); await api(`/api/lists/${id}`, { method: "PATCH", body: form }); mutate(); refreshLists(); setDialog(null); }}>
          <Field label="Name"><Input required maxLength={80} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Description"><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <Button type="submit" variant="primary">Save</Button>
        </form>
      </Modal>
      <Modal open={dialog === "delete"} onClose={() => setDialog(null)} title={`Delete “${list.name}”?`}>
        <p className="mb-4 text-sm text-muted">The list goes away for everyone on it. Its wallets stay in your account and in your other lists.</p>
        <Button variant="danger" onClick={async () => { await api(`/api/lists/${id}`, { method: "DELETE" }); await refreshLists(); router.push("/lists"); }}>Delete list</Button>
      </Modal>
    </div>
  );
}
