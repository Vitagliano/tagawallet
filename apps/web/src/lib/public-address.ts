import { ObjectId } from "mongodb";
import { parsePastedAddress } from "@tagawallet/shared";
import { getDb } from "./db";
import { resolveAddresses } from "./resolve";

/**
 * What anyone, signed in or not, may see about one address: only published profiles that publicly claim it.
 * Runs the same resolver as the extension with no viewer, so nobody's private records can appear.
 */
export async function publicAddress(raw: string) {
  const parsed = parsePastedAddress(decodeURIComponent(raw));
  if (!parsed || parsed.kind === "sns") return null;
  const [result] = await resolveAddresses([{ normalized: parsed.normalized, kind: parsed.kind }], null);
  // Public names: published contacts (with their profile) and published lists (just the name), never anyone's private records.
  const claims = (result?.labels ?? []).filter((l) => l.source === "verified" || l.source === "community");
  // Search engines may list this page only when every profile behind it allowed indexing.
  const ids = [...new Set(claims.flatMap((c) => (c.entity ? [c.entity.id] : [])))];
  const db = await getDb();
  const indexing = ids.length
    ? await db.collection("entities").countDocuments({ _id: { $in: ids.map((id) => new ObjectId(id)) }, allowIndexing: true })
    : 0;
  return {
    input: parsed.raw, kind: parsed.kind, normalized: parsed.normalized,
    /** For an ENS name, the address it points to on-chain. */
    resolved: result?.address ?? null,
    claims: claims.map((c, i) => ({
      key: c.entity?.id ?? `list-${i}`, name: c.label, slug: c.entity?.slug ?? null, verified: c.source === "verified", chain: c.chain,
      relationship: c.entity?.relationship ?? null, tags: c.tags, linkedWallets: c.entity?.linkedWallets ?? null,
      listName: c.entity ? null : c.listName ?? null, publishedBy: c.publishedBy ?? null,
    })),
    // Names from public lists have no indexing opt-in, so any of them keeps the page out of search engines.
    indexable: ids.length > 0 && indexing === ids.length && claims.every((c) => c.entity),
  };
}

/** Published, indexable profiles and the addresses they publicly claim, for the sitemap. */
export async function indexableProfiles(limit = 5000) {
  const db = await getDb();
  const entities = await db.collection("entities")
    .find({ visibility: "public", allowIndexing: true, "moderation.removedAt": null }, { projection: { slug: 1, updatedAt: 1 }, limit }).toArray();
  const links = await db.collection("wallet_entity_links")
    .find({ entityId: { $in: entities.map((e) => e._id) }, visibility: "public" }, { projection: { walletId: 1 }, limit }).toArray();
  const wallets = await db.collection("wallets").find({ _id: { $in: links.map((l) => l.walletId) } }, { projection: { address: 1 } }).toArray();
  return {
    profiles: entities.map((e) => ({ slug: e.slug as string, updatedAt: e.updatedAt as Date | undefined })),
    addresses: [...new Set(wallets.map((w) => w.address as string))],
  };
}
