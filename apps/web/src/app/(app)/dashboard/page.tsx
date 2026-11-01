"use client";

import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/client";
import { Button, Empty, Pill, VerificationPill, VisibilityPill } from "@/components/ui";
import { QuickAddWallet } from "@/components/wallet-form";
import { WalletTable } from "@/components/wallet-table";
import { NewListModal } from "@/components/app-shell";

function Onboarding({ state, onNewList }: { state: Record<string, boolean>; onNewList: () => void }) {
  const steps = [
    { key: "list", label: "Create your first list", action: <button className="underline" onClick={onNewList}>Create</button> },
    { key: "wallet", label: "Add a wallet", action: <span className="text-muted">Use the form on this page</span> },
    { key: "entity", label: "Group wallets under an entity", action: <Link className="underline" href="/entities">Open entities</Link> },
    { key: "link", label: "Link a social account to an entity", action: <Link className="underline" href="/entities">Open entities</Link> },
    { key: "extension", label: "Connect the browser extension", action: <Link className="underline" href="/settings#extension">Set up</Link> },
  ];
  const done = steps.filter((s) => state[s.key]).length;
  return (
    <section className="rounded-xl border border-line bg-card p-4">
      <h2 className="font-semibold">Getting started <span className="ml-1 text-sm font-normal text-muted">{done} of {steps.length}</span></h2>
      <ol className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        {steps.map((s) => (
          <li key={s.key} className="flex items-center gap-2">
            <span aria-hidden className={state[s.key] ? "text-good" : "text-muted"}>{state[s.key] ? "✓" : "○"}</span>
            <span className={state[s.key] ? "text-muted line-through" : ""}>{s.label}</span>
            {!state[s.key] && <span className="ml-auto text-xs">{s.action}</span>}
          </li>
        ))}
      </ol>
    </section>
  );
}

export default function Dashboard() {
  const { data } = useSWR("/api/dashboard", fetcher);
  const { data: lists } = useSWR<any[]>("/api/lists", fetcher);
  const [creating, setCreating] = useState(false);
  const allDone = data && Object.values(data.onboarding).every(Boolean);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      {data && !allDone && <Onboarding state={data.onboarding} onNewList={() => setCreating(true)} />}

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <section>
            <h2 className="mb-2 font-semibold">Recent wallets</h2>
            {data?.wallets.length ? <WalletTable wallets={data.wallets} /> : data && <Empty title="No wallets yet">Paste an address to tag your first one.</Empty>}
          </section>
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-semibold">Recent entities</h2>
              <Link href="/entities" className="text-sm text-muted hover:underline">All entities</Link>
            </div>
            {data?.entities.length ? (
              <ul className="grid gap-2 sm:grid-cols-2">
                {data.entities.map((e: any) => (
                  <li key={e.id}>
                    <Link href={`/entities/${e.id}`} className="block rounded-xl border border-line bg-card p-3 hover:bg-wash">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium">{e.name}</span>
                        <VerificationPill status={e.verification?.status} />
                      </div>
                      <div className="mt-1 text-xs capitalize text-muted">{e.type}</div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : data && <Empty title="No entities yet">An entity groups the wallets of one person, project or team.</Empty>}
          </section>
        </div>
        <div className="space-y-6">
          <section className="rounded-xl border border-line bg-card p-4">
            <h2 className="mb-3 font-semibold">Quick add</h2>
            {lists && <QuickAddWallet key={lists[0]?.id ?? "none"} lists={lists.filter((l) => l.role !== "viewer")} />}
          </section>
          <section className="rounded-xl border border-line bg-card p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-semibold">Lists</h2>
              <Button variant="ghost" onClick={() => setCreating(true)}>New</Button>
            </div>
            <ul className="space-y-1.5 text-sm">
              {lists?.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-2">
                  <Link href={`/lists/${l.id}`} className="truncate hover:underline">{l.name}</Link>
                  <span className="flex shrink-0 items-center gap-2"><Pill>{l.walletCount}</Pill><VisibilityPill visibility={l.visibility} /></span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
      <NewListModal open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}
