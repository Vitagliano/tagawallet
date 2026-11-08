"use client";

import { Suspense, use, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";
import { api, fetcher } from "@/lib/client";
import { Button, Empty, ErrorNote, Field, Input, Modal, Select, Textarea, VisibilityPill } from "@/components/ui";
import { WalletsView } from "@/components/wallets-view";
import { Menu, menuItem } from "@/components/kit";
import { KindIcon } from "@/components/collections";
import { ImportDialog } from "@/components/import-dialog";

function SharePanel({ list, onChange }: { list: any; onChange: () => void }) {
  const [email, setEmail] = useState(""), [role, setRole] = useState("viewer"), [url, setUrl] = useState(""), [error, setError] = useState("");
  const manager = list.role === "owner" || list.role === "admin";
  async function invite(withEmail: boolean) {
    setError(""); setUrl("");
    try {
      const r = await api(`/api/lists/${list.id}/members`, { body: { role, email: withEmail ? email : undefined } });
      if (withEmail) setEmail(""); else setUrl(r.url);
      onChange();
    } catch (e) { setError((e as Error).message); }
  }
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">People here see the name, labels and notes of every wallet in this list. Who a wallet belongs to stays private unless you choose otherwise on that person or project.</p>
      <ul className="divide-y divide-line text-sm">
        <li className="flex justify-between py-2"><span>{list.owner.name}</span><span className="text-muted">Owner</span></li>
        {list.collaborators.map((c: any) => (
          <li key={c.userId} className="flex items-center justify-between gap-2 py-2">
            <span className="truncate">{c.name} <span className="text-muted">{c.email}</span></span>
            {manager ? (
              <span className="flex items-center gap-2">
                <Select aria-label={`Role for ${c.name}`} className="w-auto" value={c.role} onChange={async (e) => { await api(`/api/lists/${list.id}/members/${c.userId}`, { method: "PATCH", body: { role: e.target.value } }); onChange(); }}>
                  <option value="viewer">Viewer</option><option value="editor">Editor</option><option value="admin">Admin</option>
                </Select>
                <Button variant="ghost" aria-label={`Remove ${c.name}`} onClick={async () => { await api(`/api/lists/${list.id}/members/${c.userId}`, { method: "DELETE" }); onChange(); }}>✕</Button>
              </span>
            ) : <span className="capitalize text-muted">{c.role}</span>}
          </li>
        ))}
      </ul>
      {manager && list.invites?.length > 0 && (
        <div className="space-y-1 border-t border-line pt-3">
          <h3 className="text-xs font-medium text-muted">Pending invitations</h3>
          <ul className="divide-y divide-line text-sm">
            {list.invites.map((inv: any) => (
              <li key={inv.id} className="flex items-center justify-between gap-2 py-2">
                <span className="min-w-0 truncate">{inv.email ?? "Invite link"} <span className="text-muted">· {inv.role} · expires {new Date(inv.expiresAt).toLocaleDateString()}</span></span>
                <Button variant="ghost" aria-label={`Revoke invitation ${inv.email ?? "link"}`} onClick={async () => {
                  setError("");
                  try { await api(`/api/lists/${list.id}/invites/${inv.id}`, { method: "DELETE" }); onChange(); } catch (e) { setError((e as Error).message); }
                }}>Revoke</Button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {manager && (
        <div className="space-y-2 border-t border-line pt-4">
          <div className="flex gap-2">
            <Input type="email" aria-label="Invite by email" placeholder="teammate@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Select aria-label="Role" className="w-auto" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="viewer">Viewer</option><option value="editor">Editor</option><option value="admin">Admin</option>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button variant="primary" disabled={!email} onClick={() => invite(true)}>Send invite</Button>
            <Button onClick={() => invite(false)}>Create invite link</Button>
          </div>
          {url && <Input readOnly aria-label="Invite link" value={url} onFocus={(e) => e.target.select()} />}
          <ErrorNote>{error}</ErrorNote>
          {list.visibility === "shared" && list.collaborators.length === 0 && (
            <Button variant="ghost" onClick={async () => { await api(`/api/lists/${list.id}`, { method: "PATCH", body: { visibility: "private" } }); onChange(); }}>Make private again</Button>
          )}
        </div>
      )}
    </div>
  );
}

function Activity({ id }: { id: string }) {
  const { data } = useSWR<any[]>(`/api/lists/${id}/activity`, fetcher);
  if (!data?.length) return <p className="text-sm text-muted">Nothing yet.</p>;
  return (
    <ul className="space-y-1.5 text-sm">
      {data.map((a) => <li key={a.id}><span className="font-medium">{a.actor}</span> {a.action}{a.detail ? <span className="text-muted"> · {a.detail}</span> : null}</li>)}
    </ul>
  );
}

export default function ListPage({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense><ListInner params={params} /></Suspense>;
}

function ListInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { mutate: mutateAll } = useSWRConfig();
  const { data: list, error, mutate } = useSWR(`/api/lists/${id}`, fetcher);
  const [dialog, setDialog] = useState<null | "import" | "share" | "edit" | "delete" | "activity">(null);
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
      <Modal open={dialog === "activity"} onClose={() => setDialog(null)} title="Activity">{dialog === "activity" && <Activity id={id} />}</Modal>
      <Modal open={dialog === "edit"} onClose={() => setDialog(null)} title="Rename list">
        <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); await api(`/api/lists/${id}`, { method: "PATCH", body: form }); mutate(); refreshLists(); setDialog(null); }}>
          <Field label="Name"><Input required maxLength={80} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Description"><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <Button type="submit" variant="primary">Save</Button>
        </form>
      </Modal>
      <Modal open={dialog === "delete"} onClose={() => setDialog(null)} title={`Delete “${list.name}”?`}>
        <p className="mb-4 text-sm text-muted">The list goes away for everyone on it. Its wallets stay in your account and in your other lists.</p>
        <Button variant="danger" onClick={async () => { await api(`/api/lists/${id}`, { method: "DELETE" }); await refreshLists(); router.push("/dashboard"); }}>Delete list</Button>
      </Modal>
    </div>
  );
}
