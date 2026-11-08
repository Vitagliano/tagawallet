"use client";

import useSWR from "swr";
import { parsePastedAddress, type ResolvedLabel } from "@tagawallet/shared";
import { api } from "@/lib/client";

/**
 * What TagAWallet knows about addresses beyond your own records: published profiles that publicly claim them,
 * and names from lists shared with you. Uses the same lookup as the extension, so the privacy rules are the same.
 */
export function useAddressIntel(addresses: string[]) {
  const queries = [...new Map(addresses.map((a) => parsePastedAddress(a)).filter((p) => !!p && p.kind !== "sns").map((p) => [p!.normalized, p!])).values()];
  const key = queries.length ? ["intel", ...queries.map((q) => q.normalized).sort()].join("|") : null;
  const { data, isLoading } = useSWR(key, () =>
    api<{ results: { normalized: string; labels: ResolvedLabel[] }[] }>("/api/wallets/lookup", { body: { addresses: queries.map((q) => ({ normalized: q.normalized, kind: q.kind })) } }),
    { revalidateOnFocus: false, dedupingInterval: 60_000 });
  const byAddress = new Map((data?.results ?? []).map((r) => [r.normalized, r.labels.filter((l) => l.source !== "private")]));
  const get = (address: string) => byAddress.get(parsePastedAddress(address)?.normalized ?? "") ?? [];
  return { get, loading: isLoading && !data };
}

/** Something someone made public: a published contact or list. (Older profiles may still say self_claimed.) */
export const isPublicClaim = (l: ResolvedLabel) => l.source === "verified" || l.source === "community" || l.source === "self_claimed";
export const publicPage = (address: string) => `/a/${encodeURIComponent(address)}`;

/** The best name someone else has given this address, for prefilling "Name this wallet". */
export function suggestedName(labels: ResolvedLabel[]) {
  return labels.find(isPublicClaim)?.label ?? labels.find((l) => l.source === "shared")?.label;
}

/** A one-line hint for a table row: who else claims this address. */
export function ClaimHint({ labels }: { labels: ResolvedLabel[] }) {
  const top = labels.find(isPublicClaim) ?? labels[0];
  if (!top) return null;
  const extra = labels.length - 1;
  return (
    <span title={labels.map((l) => `${l.label} (${l.provenance})`).join("\n")}
      className={`inline-flex max-w-full items-center gap-1 rounded-full px-1.5 py-px text-[11px] font-medium ${top.source === "verified" ? "bg-good/15 text-good" : "bg-wash text-muted"}`}>
      <span aria-hidden>{top.source === "verified" ? "✓" : top.source === "shared" ? "⇄" : "◎"}</span>
      <span className="truncate">{top.label}</span>
      {extra > 0 && <span className="shrink-0 opacity-70">+{extra}</span>}
      <span className="sr-only"> ({top.provenance})</span>
    </span>
  );
}
