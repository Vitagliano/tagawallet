"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { ENTITY_TYPES } from "@tagawallet/shared";
import { api, fetcher } from "@/lib/client";
import { Button, Empty, ErrorNote, Field, Input, Modal, Select, VerificationPill, VisibilityPill } from "@/components/ui";

export default function Entities() {
  const router = useRouter();
  const { data } = useSWR<any[]>("/api/entities", fetcher);
  const [open, setOpen] = useState(false), [name, setName] = useState(""), [type, setType] = useState("project"), [error, setError] = useState("");
  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Entities</h1>
        <Button variant="primary" onClick={() => setOpen(true)}>New entity</Button>
      </header>
      {data?.length ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {data.map((e) => (
            <li key={e.id}>
              <Link href={`/entities/${e.id}`} className="block rounded-xl border border-line bg-card p-4 hover:bg-wash">
                <div className="flex items-center justify-between gap-2"><span className="truncate font-medium">{e.name}</span><VisibilityPill visibility={e.visibility} /></div>
                <div className="mt-2 flex items-center justify-between text-sm text-muted">
                  <span className="capitalize">{e.type} · {e.walletCount} wallet{e.walletCount === 1 ? "" : "s"}</span>
                  <VerificationPill status={e.verification?.status} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : data && <Empty title="No entities yet">Group the wallets of one person, project, DAO or exchange, and attach their official links.</Empty>}
      <Modal open={open} onClose={() => setOpen(false)} title="New entity">
        <form className="space-y-3" onSubmit={async (e) => {
          e.preventDefault();
          try { const r = await api("/api/entities", { body: { name, type } }); router.push(`/entities/${r.id}`); }
          catch (err) { setError((err as Error).message); }
        }}>
          <Field label="Name"><Input required autoFocus value={name} placeholder="Uniswap" onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Type">
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              {ENTITY_TYPES.map((t) => <option key={t} value={t}>{t === "dao" ? "DAO" : t[0]!.toUpperCase() + t.slice(1)}</option>)}
            </Select>
          </Field>
          <p className="text-sm text-muted">Entities are private until you choose to publish them.</p>
          <ErrorNote>{error}</ErrorNote>
          <Button type="submit" variant="primary">Create entity</Button>
        </form>
      </Modal>
    </div>
  );
}
