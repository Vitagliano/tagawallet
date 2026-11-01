"use client";

import { use, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";
import { api, fetcher } from "@/lib/client";
import { Button, Empty, ErrorNote, Field, Input, Modal, Select, Textarea, VisibilityPill } from "@/components/ui";
import { QuickAddWallet } from "@/components/wallet-form";
import { WalletTable } from "@/components/wallet-table";

function MoveDialog({ wallet, listId, onClose }: { wallet: any; listId: string; onClose: () => void }) {
  const { data: lists } = useSWR<any[]>("/api/lists", fetcher);
  const { mutate } = useSWRConfig();
  const [target, setTarget] = useState(""), [error, setError] = useState("");
  async function go(move: boolean) {
    try {
      await api(`/api/lists/${target}/wallets`, { body: { walletId: wallet.id, moveFrom: move ? listId : undefined } });
      mutate((k) => typeof k === "string" && k.startsWith("/api/"));
      onClose();
    } catch (e) { setError((e as Error).message); }
  }
  return (
    <Modal open onClose={onClose} title="Move or copy wallet">
      <div className="space-y-3">
        <Field label="Destination">
          <Select value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">Choose a list…</option>
            {lists?.filter((l) => l.id !== listId && l.role !== "viewer").map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </Select>
        </Field>
        <ErrorNote>{error}</ErrorNote>
        <div className="flex gap-2">
          <Button variant="primary" disabled={!target} onClick={() => go(true)}>Move</Button>
          <Button disabled={!target} onClick={() => go(false)}>Copy</Button>
        </div>
      </div>
    </Modal>
  );
}

function ImportDialog({ listId, onClose }: { listId: string; onClose: () => void }) {
  const { mutate } = useSWRConfig();
  const file = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<any>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  async function run() {
    const f = file.current?.files?.[0];
    if (!f) return;
    setBusy(true); setError("");
    try {
      const format = f.name.toLowerCase().endsWith(".json") ? "json" : "csv";
      setResult(await api("/api/wallets/import", { body: { listId, format, content: await f.text() } }));
      mutate((k) => typeof k === "string" && k.startsWith("/api/"));
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <Modal open onClose={onClose} title="Import wallets">
      <div className="space-y-3">
        <p className="text-sm text-muted">A CSV with an <code>address</code> column, and optionally <code>chain</code>, <code>label</code>, <code>status</code>, <code>tags</code> and <code>notes</code>. Or a JSON array with the same fields.</p>
        <input ref={file} type="file" accept=".csv,.json" aria-label="File to import" className="block w-full text-sm" />
        <ErrorNote>{error}</ErrorNote>
        {result && (
          <div role="status" className="rounded-md bg-wash p-3 text-sm">
            <p>{result.imported} imported, {result.duplicates} already in this list, {result.errorCount} skipped.</p>
            {result.errors.length > 0 && <ul className="mt-2 max-h-32 overflow-auto text-xs text-muted">{result.errors.map((e: any) => <li key={e.row}>Row {e.row}: {e.message}</li>)}</ul>}
          </div>
        )}
        <Button variant="primary" onClick={run} disabled={busy}>{busy ? "Importing…" : "Import"}</Button>
      </div>
    </Modal>
  );
}

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
      <p className="text-sm text-muted">Members can see the name, notes and tags of every wallet in this list. Your entity links stay private unless you set a link to shared.</p>
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
  const { id } = use(params);
  const router = useRouter();
  const { mutate: mutateAll } = useSWRConfig();
  const { data: list, error, mutate } = useSWR(`/api/lists/${id}`, fetcher);
  const { data, mutate: mutateWallets } = useSWR(`/api/lists/${id}/wallets`, fetcher);
  const [dialog, setDialog] = useState<null | "add" | "import" | "share" | "edit" | "delete" | "activity">(null);
  const [moving, setMoving] = useState<any>(null);
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
            <h1 className="truncate text-2xl font-semibold tracking-tight">{list.name}</h1>
            <VisibilityPill visibility={list.visibility} />
            {list.archivedAt && <span className="text-sm text-muted">Archived</span>}
          </div>
          {list.description && <p className="mt-1 text-sm text-muted">{list.description}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && <Button variant="primary" onClick={() => setDialog("add")}>Add wallet</Button>}
          {canEdit && <Button onClick={() => setDialog("import")}>Import</Button>}
          <Button onClick={() => setDialog("share")}>Share</Button>
          <details className="relative">
            <summary className="flex min-h-9 cursor-pointer list-none items-center rounded-md border border-line bg-card px-3 text-sm font-medium hover:bg-wash">More</summary>
            <div className="absolute right-0 z-10 mt-1 w-48 rounded-lg border border-line bg-card p-1 text-sm">
              <a className="block rounded px-2 py-1.5 hover:bg-wash" href={`/api/lists/${id}/export?format=csv`}>Export CSV</a>
              <a className="block rounded px-2 py-1.5 hover:bg-wash" href={`/api/lists/${id}/export?format=json`}>Export JSON</a>
              <button className="block w-full rounded px-2 py-1.5 text-left hover:bg-wash" onClick={() => setDialog("activity")}>Activity</button>
              <button className="block w-full rounded px-2 py-1.5 text-left hover:bg-wash" onClick={async () => { const c = await api(`/api/lists/${id}/duplicate`, { method: "POST" }); refreshLists(); router.push(`/lists/${c.id}`); }}>Duplicate</button>
              {canEdit && <button className="block w-full rounded px-2 py-1.5 text-left hover:bg-wash" onClick={() => { setForm({ name: list.name, description: list.description ?? "" }); setDialog("edit"); }}>Rename</button>}
              {canEdit && <button className="block w-full rounded px-2 py-1.5 text-left hover:bg-wash" onClick={async () => { await api(`/api/lists/${id}`, { method: "PATCH", body: { archived: !list.archivedAt } }); mutate(); refreshLists(); }}>{list.archivedAt ? "Unarchive" : "Archive"}</button>}
              {list.role === "owner" && <button className="block w-full rounded px-2 py-1.5 text-left text-bad hover:bg-wash" onClick={() => setDialog("delete")}>Delete list</button>}
            </div>
          </details>
        </div>
      </header>

      {data?.wallets.length ? (
        <WalletTable wallets={data.wallets} actions={canEdit ? (w) => (
          <span className="flex gap-1">
            <Button variant="ghost" onClick={() => setMoving(w)}>Move</Button>
            <Button variant="ghost" onClick={async () => { await api(`/api/lists/${id}/wallets?walletId=${w.id}`, { method: "DELETE" }); mutateWallets(); refreshLists(); }}>Remove</Button>
          </span>
        ) : undefined} />
      ) : data && (
        <Empty title="This list is empty">{canEdit ? "Add a wallet, import a file, or tag one from the extension." : "Nothing has been added yet."}</Empty>
      )}

      <Modal open={dialog === "add"} onClose={() => setDialog(null)} title={`Add to ${list.name}`}><QuickAddWallet listId={id} /></Modal>
      {dialog === "import" && <ImportDialog listId={id} onClose={() => setDialog(null)} />}
      <Modal open={dialog === "share"} onClose={() => setDialog(null)} title="Share list"><SharePanel list={list} onChange={() => { mutate(); refreshLists(); }} /></Modal>
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
      {moving && <MoveDialog wallet={moving} listId={id} onClose={() => setMoving(null)} />}
    </div>
  );
}
