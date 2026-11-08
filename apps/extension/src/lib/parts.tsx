import { useEffect, useRef } from "react";
import type { Bootstrap, ResolvedLabel } from "./messages";
import { buildTagForm } from "./tag-form";

/** Pieces shared by the toolbar popup and the side panel. */

export type Target = { address: string; kind: "evm" | "solana" | "bitcoin"; existing: ResolvedLabel | null };
export const taggable = (kind: string): kind is Target["kind"] => kind === "evm" || kind === "solana" || kind === "bitcoin";

/** Mounts the shared plain-DOM tag form. */
export function TagForm({ target, boot, host, path, onDone, onCancel }: { target: Target | { address: ""; kind?: undefined; existing: null }; boot: Bootstrap | null; host: string; path: string; onDone: (m: string) => void; onCancel: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const form = buildTagForm({ address: target.address, kind: target.kind, existing: target.existing, boot, host, path, onDone, onCancel });
    ref.current?.replaceChildren(form);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <div ref={ref} />;
}

export function Switch({ on, label, onChange }: { on: boolean; label: string; onChange: () => void }) {
  return <button role="switch" aria-checked={on} aria-label={label} className={`switch${on ? " on" : ""}`} onClick={onChange}><span /></button>;
}

const ROLE_WORD: Record<string, string> = {
  owner: "owner", treasury: "treasury", hot_wallet: "hot wallet", cold_wallet: "cold wallet", associated: "", custom: "custom",
};

/** Person or project when linked, otherwise the private wallet name. */
export function displayName(top: ResolvedLabel) {
  return top.entity?.name || top.label;
}
export function roleWord(top: ResolvedLabel) {
  const r = top.entity?.relationship;
  return r ? ROLE_WORD[r] ?? r.replace(/_/g, " ") : "";
}
/** How a row reads on a page scan: "Uniswap · hot wallet" or the private name or "Not linked". */
export function rowTitle(top: ResolvedLabel | undefined) {
  if (!top) return null;
  if (top.entity) {
    const role = roleWord(top);
    const own = top.label && top.label !== top.entity.name ? top.label : "";
    const detail = role || own;
    return detail ? `${top.entity.name} · ${detail}` : top.entity.name;
  }
  return top.label || "Tagged";
}

export const isFlagged = (labels: ResolvedLabel[]) => labels.some((l) => l.status === "watchlist" || l.status === "scam");

/** Where "Open" goes for a label: the contact, the wallet, or the dashboard. */
export const labelPath = (top: ResolvedLabel) => top.entity ? `/entities/${top.entity.id}` : top.walletId ? `/wallets?w=${top.walletId}` : "/dashboard";
