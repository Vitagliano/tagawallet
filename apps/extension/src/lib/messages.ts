import type { ResolveResult, ResolvedLabel } from "@tagawallet/shared/lite";

export type QueryAddress = { normalized: string; kind: "evm" | "solana" | "bitcoin" | "ens" | "sns" };

export interface Settings {
  chipsEnabled: boolean; chipStyle: "minimal" | "badge" | "hidden"; disabledSites: string[]; enabledSites: string[];
  cloudSync: boolean; defaultListId: string | null; theme: "system" | "light" | "dark";
}
export const DEFAULT_SETTINGS: Settings = {
  chipsEnabled: true, chipStyle: "badge", disabledSites: [], enabledSites: [], cloudSync: true, defaultListId: null, theme: "system",
};

export interface TagInput {
  address: string; chain: string; displayLabel: string; notes?: string; tags?: string[]; status?: string;
  links?: { type: string; url: string; label?: string; status?: string }[];
  listId?: string; newListName?: string; entityId?: string; newEntityName?: string;
}
export interface Bootstrap {
  user: { displayName: string; email: string | null } | null;
  lists: { id: string; name: string; visibility: string }[];
  entities: { id: string; name: string }[];
  lastListId: string | null;
}
export type TagResult = { ok: true; queued: boolean; listName: string; shared: boolean } | { ok: false; error: string; needsAccount?: boolean };

export type Message =
  | { type: "resolve"; addresses: QueryAddress[] }
  | { type: "handles" }
  | { type: "tag"; input: TagInput }
  | { type: "bootstrap" }
  | { type: "settings" }
  | { type: "updateSettings"; patch: Partial<Settings> }
  | { type: "setSiteEnabled"; host: string; enabled: boolean }
  | { type: "contentState"; host: string }
  | { type: "signOut" }
  | { type: "status" }
  | { type: "sites" }
  | { type: "flush" }
  | { type: "track"; name: string; value?: number }
  | { type: "open"; path: string };

export function send<T = any>(message: Message): Promise<T> {
  return chrome.runtime.sendMessage(message);
}

export type TabMessage =
  | { type: "taw:scan" }
  | { type: "taw:refresh" }
  | { type: "taw:settings" };

export interface Detected { raw: string; normalized: string; kind: QueryAddress["kind"] | "x"; chain: string; labels: ResolvedLabel[] }
export type { ResolveResult, ResolvedLabel };

/** A hostname's most likely chain, used only to preselect the chain in the tag form. */
export function chainFromHost(host: string, kind: string): string {
  if (kind === "solana") return "solana";
  if (kind === "bitcoin") return "bitcoin";
  if (host.endsWith("basescan.org")) return "base";
  if (host.endsWith("arbiscan.io")) return "arbitrum";
  if (host.includes("optimistic.etherscan") || host.endsWith("optimism.io")) return "optimism";
  if (host.endsWith("polygonscan.com")) return "polygon";
  if (host.endsWith("bscscan.com")) return "bsc";
  return "ethereum";
}
