"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, Empty } from "@/components/ui";
import { Help } from "@/components/kit";
import { KINDS, KindIcon, kindLabel, useCollections, useCreate, type Kind } from "@/components/collections";

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");

/** Lists, people and projects in one place. Each is just a named group of wallets. */
export default function Lists() {
  const { all, ready } = useCollections();
  const { newList } = useCreate();
  const [kind, setKind] = useState<Kind | "">(""), [q, setQ] = useState("");
  const shown = all.filter((c) => (!kind || c.kind === kind) && (!q.trim() || c.name.toLowerCase().includes(q.trim().toLowerCase())));
  const count = (k: Kind) => all.filter((c) => c.kind === k).length;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Lists</h1>
          <Help>Group wallets however suits you: a plain list, everything one person controls, or a project&apos;s wallets. A wallet can be in several, or in none.</Help>
        </div>
        <Button variant="primary" onClick={() => newList(kind || "list")}>New list</Button>
      </header>

      {all.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" role="toolbar" aria-label="Show">
          {[{ kind: "" as const, plural: "All", n: all.length }, ...KINDS.map((k) => ({ kind: k.kind, plural: k.plural, n: count(k.kind) }))].map((k) => (
            <button key={k.kind || "all"} aria-pressed={kind === k.kind} onClick={() => setKind(k.kind)}
              className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition ${kind === k.kind ? "bg-ink text-paper" : "bg-card text-muted hover:text-ink"}`}>
              {k.kind && <KindIcon kind={k.kind} className="size-3.5" />}{k.plural}<span className="tabular-nums opacity-60">{k.n}</span>
            </button>
          ))}
          {all.length > 8 && (
            <input type="search" aria-label="Find a list" placeholder="Find a list" value={q} onChange={(e) => setQ(e.target.value)}
              className="ml-auto h-8 w-full rounded-full bg-card px-3 text-xs sm:w-56" />
          )}
        </div>
      )}

      {!ready ? (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
          {[0, 1, 2].map((i) => <li key={i} className="h-20 animate-pulse rounded-2xl bg-card" />)}
        </ul>
      ) : shown.length ? (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((c) => (
            <li key={`${c.kind}-${c.id}`}>
              <Link href={c.href} className="flex h-full gap-3 rounded-2xl bg-card p-4 hover:bg-wash">
                {c.avatarUrl
                  ? <img src={c.avatarUrl} alt="" className="size-10 shrink-0 rounded-full object-cover" />
                  : c.kind === "list"
                    ? <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-lg bg-wash text-muted"><KindIcon kind="list" /></span>
                    : <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-wash text-sm font-semibold text-muted">{initials(c.name)}</span>}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{c.name}</span>
                  <span className="flex flex-wrap items-center gap-x-1.5 text-sm text-muted">
                    <span>{kindLabel(c.kind)}</span>·<span className="tabular-nums">{c.count} wallet{c.count === 1 ? "" : "s"}</span>
                    {c.shared && <span className="text-warn">· Shared</span>}
                    {c.isPublic && <span className="text-accent">· {c.verified ? "✓ Public" : "Public"}</span>}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : all.length ? <Empty title="No matches" /> : (
        <div className="rounded-2xl bg-card px-6 py-12 text-center">
          <p className="font-medium">No lists yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">Make one for anything: a watchlist, a person whose wallets you track, or a project&apos;s treasury. Wallets don&apos;t need a list to be saved.</p>
          <Button variant="primary" className="mt-4" onClick={() => newList("list")}>New list</Button>
        </div>
      )}
    </div>
  );
}
