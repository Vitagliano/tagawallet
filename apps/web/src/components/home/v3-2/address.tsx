"use client";

import Link from "next/link";
import { truncateAddress } from "@tagawallet/shared";
import { Button } from "@/components/ui";
import { useCreate, type CollectionChoice } from "@/components/collections";
import { ClaimHint, publicPage, suggestedName, useAddressIntel } from "@/components/features/address-intel";
import { press } from "./ui";

type Into = (CollectionChoice & { id: string }) | undefined;

/** A pasted address that isn't saved yet: one line that says who others think it is, and offers that name. */
export function NewAddress({ address, into }: { address: string; into: Into }) {
  const { addWallet } = useCreate();
  const { get, loading } = useAddressIntel([address]);
  const labels = get(address);
  const where = into ? into.name : "your wallets";
  const name = suggestedName(labels);
  return (
    <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-card py-2.5 pr-2.5 pl-4 text-sm">
      <span className="min-w-0 flex-1">
        <span className="addr">{truncateAddress(address)}</span> isn&apos;t in {where} yet.
        {labels.length > 0 && <span className="ml-2 inline-flex max-w-full align-middle"><ClaimHint labels={labels} /></span>}
        {!loading && !labels.length && <Link href={publicPage(address)} target="_blank" className="ml-2 text-xs text-muted hover:text-ink">Nobody published a name for it ↗</Link>}
      </span>
      {name && <Button className={press} onClick={() => addWallet({ address, into })}>Add without a name</Button>}
      <Button variant="primary" className={press} onClick={() => addWallet({ address, into, name })}>{name ? `Add as “${name}”` : `Add wallet${into ? ` to ${into.name}` : ""}`}</Button>
    </div>
  );
}

/** Row hints: who else names each address on this page, from one lookup. A row's own record (seen through a shared list) isn't a hint. */
export function useRowHints(enabled: boolean, addresses: string[]) {
  const { get } = useAddressIntel(enabled ? addresses : []);
  return (address: string, walletId?: string) => (enabled ? get(address).filter((l) => !walletId || l.walletId !== walletId) : []);
}
