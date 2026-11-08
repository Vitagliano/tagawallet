export type LabelSource = "private" | "shared" | "self_claimed" | "verified" | "community" | "official";

export function provenanceText(source: LabelSource, listName?: string): string {
  switch (source) {
    case "private": return "Your private tag";
    case "shared": return `Shared by ${listName ?? "a list"}`;
    case "self_claimed": return "Self-claimed";
    case "verified": return "Verified";
    case "community": return "Community";
    case "official": return "Official";
  }
}

/** The label a person sees in a chip or card, in the shape the resolve API returns. */
export interface ResolvedLabel {
  source: LabelSource;
  provenance: string;
  label: string;
  walletId?: string;
  chain: string;
  tags: string[];
  status?: string;
  notes?: string;
  entity?: { id: string; name: string; slug?: string; verification: string; linkedWallets: number };
  /** For a public claim: the wallet-to-profile link, so that one wallet's label can be reported. */
  linkId?: string;
  links: { type: string; url: string; label?: string }[];
  listName?: string;
  shared: boolean;
}

export interface ResolveResult {
  normalized: string;
  labels: ResolvedLabel[];
  /** For an ENS name: the address it points to on-chain, so an untagged name can still be tagged. */
  address?: string;
}

// Strongest claim the viewer has made first: their own words beat anyone else's.
const ORDER: LabelSource[] = ["private", "shared", "verified", "official", "self_claimed", "community"];
export function sortLabels(labels: ResolvedLabel[]): ResolvedLabel[] {
  return [...labels].sort((a, b) => ORDER.indexOf(a.source) - ORDER.indexOf(b.source));
}

/** One X account the viewer may recognize, with the wallet to open when there is one. */
export interface HandleEntry {
  handle: string;
  address?: string;
  normalized?: string;
  family?: "evm" | "solana" | "bitcoin";
  labels: ResolvedLabel[];
}
