import type { Document, ObjectId } from "mongodb";
import { chainFamily, provenanceText, sortLabels, xHandleFromUrl, type ChainId, type HandleEntry, type ResolvedLabel } from "@tagawallet/shared";
import { collaboratorListIds } from "./access";
import { getDb } from "./db";
import { resolveAddresses } from "./resolve";

const X_LINK = { links: { $elemMatch: { type: "x" } } };

const handlesOf = (doc: Document) =>
  (doc.links ?? []).filter((l: Document) => l.type === "x").map((l: Document) => xHandleFromUrl(l.url)).filter(Boolean) as string[];

/**
 * Every X account this viewer may recognize. It follows the same rules as resolveAddresses, plus one:
 * a public claim only counts if the entity proved control of that account. Otherwise anyone could
 * put a self-claimed label on a stranger's profile.
 */
export async function handleIndex(viewerId: ObjectId): Promise<HandleEntry[]> {
  const db = await getDb();
  const wallets = db.collection("wallets");
  const links = db.collection("wallet_entity_links");
  const entities = db.collection("entities");
  const pairs: { handle: string; wallet: Document }[] = [];
  const orphans: { handle: string; entity: Document }[] = [];

  const addEntity = async (entity: Document, handles: string[], filter: Document) => {
    const linked = await links.find({ entityId: entity._id, ...filter }, { projection: { walletId: 1 } }).toArray();
    const found = await wallets.find({ _id: { $in: linked.map((l) => l.walletId) } }, { projection: { address: 1, chain: 1, normalizedAddress: 1 } }).limit(1).toArray();
    for (const handle of handles) {
      if (found[0]) pairs.push({ handle, wallet: found[0] });
      else orphans.push({ handle, entity });
    }
  };

  const sharedLists = await collaboratorListIds(viewerId);
  const sharedIds = sharedLists.length
    ? (await db.collection("wallet_list_memberships").find({ listId: { $in: sharedLists } }, { projection: { walletId: 1 } }).toArray()).map((m) => m.walletId)
    : [];
  const direct = await wallets.find({ ...X_LINK, $or: [{ ownerId: viewerId }, { _id: { $in: sharedIds } }] }).limit(5000).toArray();
  for (const w of direct) for (const handle of handlesOf(w)) pairs.push({ handle, wallet: w });

  for (const e of await entities.find({ ownerId: viewerId, ...X_LINK }).limit(5000).toArray()) await addEntity(e, handlesOf(e), {});

  if (sharedIds.length) {
    const visible = await links.find({ walletId: { $in: sharedIds }, visibility: { $ne: "private" } }, { projection: { entityId: 1 } }).toArray();
    const shared = await entities.find({ _id: { $in: visible.map((l) => l.entityId) }, ownerId: { $ne: viewerId }, ...X_LINK }).toArray();
    for (const e of shared) await addEntity(e, handlesOf(e), { walletId: { $in: sharedIds }, visibility: { $ne: "private" } });
  }

  const published = await entities.find({
    visibility: "public", "moderation.removedAt": null, ownerId: { $ne: viewerId }, "verification.proofs": { $elemMatch: { method: "x_post" } },
  }).limit(5000).toArray();
  for (const e of published) {
    const proven = (e.verification.proofs as Document[]).filter((p) => p.method === "x_post").map((p) => xHandleFromUrl(p.target));
    await addEntity(e, handlesOf(e).filter((h) => proven.includes(h)), { visibility: "public" });
  }

  const queries = [...new Map(pairs.map(({ wallet: w }) => [w.normalizedAddress, { normalized: w.normalizedAddress as string, kind: chainFamily(w.chain as ChainId) }])).values()];
  const resolved = new Map((await resolveAddresses(queries, viewerId)).map((r) => [r.normalized, r.labels]));

  const out = new Map<string, HandleEntry>();
  const entry = (handle: string) => out.get(handle) ?? out.set(handle, { handle, labels: [] }).get(handle)!;
  const addLabels = (e: HandleEntry, labels: ResolvedLabel[]) => {
    for (const l of labels) if (!e.labels.some((x) => x.label === l.label && x.source === l.source)) e.labels.push(l);
    e.labels = sortLabels(e.labels);
  };
  for (const { handle, wallet } of pairs) {
    const e = entry(handle);
    e.address ??= wallet.address; e.normalized ??= wallet.normalizedAddress; e.family ??= chainFamily(wallet.chain as ChainId);
    addLabels(e, resolved.get(wallet.normalizedAddress) ?? []);
  }
  for (const { handle, entity } of orphans) {
    const own = entity.ownerId?.equals(viewerId);
    const source = own ? "private" : entity.visibility === "public" ? "verified" : "shared";
    addLabels(entry(handle), [{
      source, provenance: provenanceText(source), label: entity.name, chain: "ethereum", tags: entity.tags ?? [], shared: !own,
      links: (entity.links ?? []).map((l: Document) => ({ type: l.type, url: l.url, label: l.label })),
      entity: { id: entity._id.toString(), name: entity.name, slug: entity.slug, verification: entity.verification?.status ?? "unverified", linkedWallets: 0 },
    }]);
  }
  return [...out.values()].filter((e) => e.labels.length);
}
