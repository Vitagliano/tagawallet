import type { ResolveResult, ResolvedLabel } from "@tagawallet/shared/lite";

export type QueryAddress = { normalized: string; kind: "evm" | "solana" | "bitcoin" | "ens" | "sns" };

export interface Settings {
  chipsEnabled: boolean; chipStyle: "minimal" | "badge" | "hidden"; disabledSites: string[]; enabledSites: string[];
  cloudSync: boolean; defaultListId: string | null; theme: "system" | "light" | "dark";
  /** A small mark on addresses nobody has tagged yet. Off shows chips only for known wallets. */
  showUnknown: boolean;
}
export const DEFAULT_SETTINGS: Settings = {
  chipsEnabled: true, chipStyle: "badge", disabledSites: [], enabledSites: [], cloudSync: true, defaultListId: null, theme: "system", showUnknown: true,
};

export interface TagInput {
  address: string; chain: string; displayLabel: string; notes?: string; tags?: string[]; status?: string;
  links?: { type: string; url: string; label?: string; status?: string }[];
  listId?: string; newListName?: string; entityId?: string; newEntityName?: string;
}
export interface Bootstrap {
  user: { displayName: string; email: string | null } | null;
  lists: { id: string; name: string; visibility: string }[];
  entities: { id: string; name: string; type?: string }[];
  lastListId: string | null;
}
/** A queued change waiting to sync. A delete carries only the address and chain. */
export type QueueItem = TagInput | { op: "untag"; address: string; chain: string };
export const isUntag = (q: QueueItem): q is Extract<QueueItem, { op: "untag" }> => (q as { op?: string }).op === "untag";
/** A tag the server refused. Kept so the person can fix or drop it, rather than lost silently. */
export interface FailedTag { normalized: string; input: TagInput; error: string; at: number; label: ResolvedLabel }
/** "expired" means a token was rejected: the person was connected and needs to reconnect. */
export type AuthState = "connected" | "expired" | "signedOut";
export interface Status { connected: boolean; authState: AuthState; queued: number; failed: FailedTag[]; sites: string[]; apiBase: string }
export type UntagResult = { ok: true; queued: boolean } | { ok: false; error: string; needsAccount?: boolean };

export type TagResult = { ok: true; queued: boolean; listName: string | null; shared: boolean } | { ok: false; error: string; needsAccount?: boolean };

/** The built-in statuses, offered as one-tap chips. "none" is the absence of one. */
export const QUICK_STATUSES = [
  ["mine", "Mine"],
  ["trusted", "Trusted"],
  ["watchlist", "Watchlist"],
  ["scam", "Scam"],
] as const;

export type Message =
  | { type: "resolve"; addresses: QueryAddress[] }
  | { type: "handles" }
  /** The on-chain address behind each ENS name, from the last lookup. */
  | { type: "names"; names: string[] }
  | { type: "tag"; input: TagInput }
  | { type: "untag"; address: string; chain: string }
  | { type: "retryFailed"; normalized: string }
  | { type: "discardFailed"; normalized: string }
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
  | { type: "taw:settings" }
  | { type: "taw:tagSelection"; text: string };

export interface Detected { raw: string; normalized: string; kind: QueryAddress["kind"] | "x"; chain: string; labels: ResolvedLabel[] }
export type { ResolveResult, ResolvedLabel };

const BLOCKSCOUT: Record<string, string> = { eth: "ethereum", base: "base", optimism: "optimism", arbitrum: "arbitrum", polygon: "polygon", bsc: "bsc" };

/** A hostname's most likely chain, used only to preselect the chain in the tag form. */
export function chainFromHost(host: string, kind: string): string {
  if (kind === "solana" || kind === "sns") return "solana";
  if (kind === "bitcoin") return "bitcoin";
  if (host.endsWith("basescan.org")) return "base";
  if (host.endsWith("arbiscan.io")) return "arbitrum";
  if (host.includes("optimistic.etherscan") || host.endsWith("optimism.io")) return "optimism";
  if (host.endsWith("polygonscan.com")) return "polygon";
  if (host.endsWith("bscscan.com")) return "bsc";
  // Blockscout runs one explorer per chain, named by subdomain: base.blockscout.com, optimism.blockscout.com…
  if (host.endsWith(".blockscout.com")) return BLOCKSCOUT[host.slice(0, -".blockscout.com".length)] ?? "ethereum";
  return "ethereum";
}

const MULTI_CHAIN_HOST = /(^|\.)(dexscreener\.com|debank\.com|zerion\.io|opensea\.io|arkm\.com)$/;
const PATH_CHAIN: [RegExp, string][] = [
  [/(^|\/)base(\/|$)/i, "base"],
  [/(^|\/)arbitrum(\/|$)/i, "arbitrum"],
  [/(^|\/)optimism(\/|$)/i, "optimism"],
  [/(^|\/)(polygon|matic)(\/|$)/i, "polygon"],
  [/(^|\/)(bsc|bnb)(\/|$)/i, "bsc"],
  [/(^|\/)(solana|sol)(\/|$)/i, "solana"],
  [/(^|\/)bitcoin(\/|$)/i, "bitcoin"],
  [/(^|\/)(ethereum|eth)(\/|$)/i, "ethereum"],
];

/** Explorers are implied by the host. Dexscreener, Debank, Zerion, OpenSea and Arkham put the chain in the path. */
export function chainFromLocation(host: string, path: string, kind: string): string {
  const fromHost = chainFromHost(host, kind);
  if (!MULTI_CHAIN_HOST.test(host) || kind === "solana" || kind === "sns" || kind === "bitcoin") return fromHost;
  for (const [re, id] of PATH_CHAIN) if (re.test(path)) return id;
  return fromHost;
}
