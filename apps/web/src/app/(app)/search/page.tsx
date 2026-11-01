"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { CHAIN_IDS, CHAINS } from "@tagawallet/shared";
import { fetcher } from "@/lib/client";
import { Empty, Input, Select, VerificationPill } from "@/components/ui";
import { WalletTable } from "@/components/wallet-table";

function SearchInner() {
  const initial = useSearchParams().get("q") ?? "";
  const [q, setQ] = useState(initial), [debounced, setDebounced] = useState(initial), [chain, setChain] = useState("");
  useEffect(() => { const t = setTimeout(() => setDebounced(q), 150); return () => clearTimeout(t); }, [q]);
  const key = debounced.trim() || chain ? `/api/search?q=${encodeURIComponent(debounced)}&chain=${chain}` : null;
  const { data } = useSWR(key, fetcher, { keepPreviousData: true });
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">Search</h1>
      <div className="flex gap-2">
        <Input autoFocus type="search" aria-label="Search" placeholder="Address, name, tag, note, list, or social link" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select aria-label="Chain" className="w-auto" value={chain} onChange={(e) => setChain(e.target.value)}>
          <option value="">All chains</option>
          {CHAIN_IDS.map((c) => <option key={c} value={c}>{CHAINS[c].name}</option>)}
        </Select>
      </div>
      {data && key && (
        <>
          {data.entities.length > 0 && (
            <section>
              <h2 className="mb-2 font-semibold">Entities</h2>
              <ul className="divide-y divide-line rounded-xl border border-line bg-card">
                {data.entities.map((e: any) => (
                  <li key={e.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                    <Link className="truncate font-medium hover:underline" href={`/entities/${e.id}`}>{e.name}</Link>
                    <VerificationPill status={e.verification?.status} />
                  </li>
                ))}
              </ul>
            </section>
          )}
          {data.wallets.length > 0 && <section><h2 className="mb-2 font-semibold">Wallets</h2><WalletTable wallets={data.wallets} /></section>}
          {!data.wallets.length && !data.entities.length && <Empty title="No matches">Search covers your own wallets and lists shared with you.</Empty>}
        </>
      )}
    </div>
  );
}
export default function Search() {
  return <Suspense><SearchInner /></Suspense>;
}
