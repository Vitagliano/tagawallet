"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { PublishedAs } from "./contact-public";
import { api, fetcher } from "@/lib/client";
import { Button, ErrorNote, Input, Select } from "@/components/ui";

/** Sharing a list and what happened in it. Shared by the list page and home. */

export function SharePanel({ list, onChange }: { list: any; onChange: () => void }) {
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
      <p className="text-sm text-muted">People here see the name, labels and notes of every wallet in this list. Who a wallet belongs to stays private unless you choose otherwise on that contact.</p>
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

export function ListActivity({ id }: { id: string }) {
  const { data } = useSWR<any[]>(`/api/lists/${id}/activity`, fetcher);
  if (!data?.length) return <p className="text-sm text-muted">Nothing yet.</p>;
  return (
    <ul className="space-y-1.5 text-sm">
      {data.map((a) => <li key={a.id}><span className="font-medium">{a.actor}</span> {a.action}{a.detail ? <span className="text-muted"> · {a.detail}</span> : null}</li>)}
    </ul>
  );
}

/** Making a list public at /l/<id>. Only its owner can, and only the wallets they added appear there. */
export function ListPublic({ list, onChange }: { list: any; onChange: () => void }) {
  const [ack, setAck] = useState(false), [error, setError] = useState("");
  const owner = list.role === "owner";
  const set = async (publish: boolean) => {
    setError("");
    try { await api(`/api/lists/${list.id}/publish`, { body: { publish } }); onChange(); } catch (e) { setError((e as Error).message); }
  };
  if (list.publishedAt) return (
    <div className="space-y-3 text-sm">
      <p>Public at <Link className="underline" href={`/l/${list.id}`} target="_blank">tagawallet.com/l/{list.id.slice(-8)}</Link>. Anyone can see the names and labels of the wallets you added. People looking an address up see them too.</p>
      <PublishedAs />
      {owner ? <Button onClick={() => void set(false)}>Make private</Button> : <p className="text-xs text-muted">Only the owner can make it private.</p>}
      <ErrorNote>{error}</ErrorNote>
    </div>
  );
  if (!owner) return <p className="text-sm text-muted">Only the list&apos;s owner can make it public.</p>;
  return (
    <div className="space-y-3 text-sm">
      <p className="text-pretty text-muted">A public list shows your names and labels for the wallets in it, as published by you. Notes never appear, and wallets other members added stay private.</p>
      <label className="flex gap-2"><input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} /> I&apos;m sharing my names for these wallets publicly, with no one&apos;s private personal information.</label>
      <ErrorNote>{error}</ErrorNote>
      <Button variant="primary" disabled={!ack} onClick={() => void set(true)}>Make public</Button>
      <PublishedAs />
    </div>
  );
}
