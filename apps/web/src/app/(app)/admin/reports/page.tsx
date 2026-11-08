"use client";

import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import { api, fetcher } from "@/lib/client";
import { truncateAddress } from "@tagawallet/shared";
import { Button, ChainName, Empty, ErrorNote, Input, Pill, Select, VerificationPill } from "@/components/ui";
import { AdminNav } from "../admin-nav";

function Report({ r, onDone }: { r: any; onDone: () => void }) {
  const [note, setNote] = useState(""), [error, setError] = useState("");
  const act = async (action: string) => {
    try { await api(`/api/admin/reports/${r.id}`, { body: { action, note } }); onDone(); }
    catch (e) { setError((e as Error).message); }
  };
  return (
    <li className="space-y-3 rounded-2xl bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone="warn">{r.reason.replace("_", " ")}</Pill>
        {r.entity?.slug ? <Link className="font-medium underline" href={`/p/${r.entity.slug}`}>{r.entity.name}</Link> : <span className="font-medium">{r.entity?.name ?? r.targetType}</span>}
        <VerificationPill status={r.entity?.verification?.status} />
        {r.link && <Pill>Wallet {r.link.address ? truncateAddress(r.link.address) : ""}{r.link.chain ? <> · <ChainName chain={r.link.chain} /></> : null}{r.link.signed ? " · signed" : ""}</Pill>}
        {r.ownerRestricted && <Pill tone="bad">Owner restricted</Pill>}
        <span className="ml-auto text-xs text-muted">{new Date(r.createdAt).toLocaleString()} · {r.priorReports} report{r.priorReports === 1 ? "" : "s"} on this target</span>
      </div>
      {r.details && <p className="whitespace-pre-wrap text-sm">{r.details}</p>}
      <Input aria-label="Moderator note" placeholder="Note, shown on the profile if you annotate" value={note} onChange={(e) => setNote(e.target.value)} />
      <ErrorNote>{error}</ErrorNote>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => act("review")}>Mark reviewing</Button>
        <Button onClick={() => act("preserve")}>Preserve</Button>
        <Button disabled={!note} onClick={() => act("annotate")}>Annotate</Button>
        <Button variant="danger" onClick={() => act("remove")}>{r.link ? "Remove wallet claim" : "Remove profile"}</Button>
        {r.ownerRestricted
          ? <Button onClick={() => act("unrestrict_owner")}>Lift restriction</Button>
          : <Button variant="danger" onClick={() => act("restrict_owner")}>Restrict owner</Button>}
        <Button variant="ghost" onClick={() => act("dismiss")}>Dismiss</Button>
      </div>
    </li>
  );
}

function Restricted() {
  const { data, mutate } = useSWR<any[]>("/api/admin/restricted", fetcher);
  const [error, setError] = useState("");
  if (!data) return null;
  if (!data.length) return <Empty title="No restricted accounts" />;
  return (
    <div className="space-y-2">
      <ErrorNote>{error}</ErrorNote>
      <ul className="divide-y divide-line rounded-2xl bg-card">
        {data.map((u) => (
          <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
            <span className="min-w-0 truncate"><span className="font-medium">{u.displayName}</span> <span className="text-muted">{u.email} · since {new Date(u.restrictedAt).toLocaleDateString()}</span></span>
            <Button onClick={async () => { setError(""); try { await api(`/api/admin/restricted/${u.id}`, { method: "DELETE" }); await mutate(); } catch (e) { setError((e as Error).message); } }}>Lift restriction</Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Reports() {
  const [status, setStatus] = useState("open");
  const restricted = status === "restricted";
  const { data, error, mutate } = useSWR<any[]>(restricted ? null : `/api/admin/reports?status=${status}`, fetcher);
  if (error) return <Empty title="Moderators only" />;
  return (
    <div className="space-y-5">
      <AdminNav />
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{restricted ? "Restricted accounts" : "Moderation queue"}</h1>
        <Select aria-label="Status" className="w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="open">Open</option><option value="reviewing">Reviewing</option><option value="resolved">Resolved</option><option value="dismissed">Dismissed</option>
          <option value="restricted">Restricted accounts</option>
        </Select>
      </header>
      {restricted ? <Restricted /> : data?.length ? <ul className="space-y-3">{data.map((r) => <Report key={r.id} r={r} onDone={() => mutate()} />)}</ul> : data && <Empty title="Nothing in this queue" />}
    </div>
  );
}
