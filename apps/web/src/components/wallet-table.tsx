"use client";

import Link from "next/link";
import { Address, ChainName, Pill, StatusPill } from "./ui";

export function WalletTable({ wallets, actions }: { wallets: any[]; actions?: (w: any) => React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-card">
      <ul className="divide-y divide-line">
        {wallets.map((w) => (
          <li key={w.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
            <div className="min-w-0 flex-1 basis-56">
              <Link href={`/wallets/${w.id}`} className="block truncate font-medium hover:underline">
                {w.displayLabel || <span className="text-muted">Unnamed wallet</span>}
              </Link>
              <div className="flex flex-wrap items-center gap-x-1 text-xs text-muted">
                <Address value={w.address} /> · <ChainName chain={w.chain} />
                {w.entities?.[0] && <>· <Link className="hover:underline" href={`/entities/${w.entities[0].id}`}>{w.entities[0].name}</Link></>}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <StatusPill status={w.status} />
              {w.tags?.slice(0, 4).map((t: string) => <Pill key={t}>{t}</Pill>)}
            </div>
            {w.lists?.length > 0 && <div className="hidden text-xs text-muted md:block">{w.lists.map((l: any) => l.name).join(", ")}</div>}
            {actions?.(w)}
          </li>
        ))}
      </ul>
    </div>
  );
}
