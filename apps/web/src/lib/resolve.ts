import type { ObjectId, Document } from "mongodb";
import { chainFamily, provenanceText, sortLabels, type ChainId, type ResolvedLabel, type ResolveResult } from "@tagawallet/shared";
import { getDb } from "./db";
import { collaboratorListIds } from "./access";

type Query = { normalized: string; kind: string };

async function linkedCounts(entityIds: ObjectId[], visibilities?: string[]) {
  const db = await getDb();
  const match: Document = { entityId: { $in: entityIds } };
  if (visibilities) match.visibility = { $in: visibilities };
  const rows = await db.collection("wallet_entity_links")
    .aggregate([{ $match: match }, { $group: { _id: "$entityId", n: { $sum: 1 } } }]).toArray();
  return new Map(rows.map((r) => [r._id.toString(), r.n as number]));
}

function entityInfo(e: Document, counts: Map<string, number>) {
  return {
    id: e._id.toString(), name: e.name, slug: e.slug, verification: e.verification?.status ?? "unverified",
    linkedWallets: counts.get(e._id.toString()) ?? 0,
  };
}
const linkView = (l: Document) => ({ type: l.type, url: l.url, label: l.label });

/**
 * The privacy boundary of the product. A label is returned only when it comes from
 *  1. the viewer's own wallet record,
 *  2. a list explicitly shared with the viewer, or
 *  3. a published entity's explicitly public link.
 * Other people's private records with the same address are never read into a label.
 */
export async function resolveAddresses(queries: Query[], viewerId: ObjectId | null): Promise<ResolveResult[]> {
  const db = await getDb();
  const addrs = queries.filter((q) => q.kind === "evm" || q.kind === "solana" || q.kind === "bitcoin");
  const names = queries.filter((q) => q.kind === "ens" || q.kind === "sns").map((q) => q.normalized);
  const family = new Map(addrs.map((q) => [q.normalized, q.kind]));
  const norm = addrs.map((q) => q.normalized);
  const out = new Map<string, ResolvedLabel[]>(queries.map((q) => [q.normalized, []]));
  const fits = (w: Document) => family.get(w.normalizedAddress) === chainFamily(w.chain as ChainId);

  // 1 + 2: records the viewer may see.
  let visible: Document[] = [];
  const listNames = new Map<string, string>();
  const viaList = new Map<string, Document>();
  if (viewerId) {
    const own = await db.collection("wallets").find({
      ownerId: viewerId,
      $or: [{ normalizedAddress: { $in: norm } }, ...(names.length ? [{ links: { $elemMatch: { type: "ens", url: { $in: names } } } }] : [])],
    }).toArray();
    visible = own;
    const sharedIds = await collaboratorListIds(viewerId);
    if (sharedIds.length && (norm.length || names.length)) {
      const candidates = await db.collection("wallets").find({
        ownerId: { $ne: viewerId },
        $or: [{ normalizedAddress: { $in: norm } }, ...(names.length ? [{ links: { $elemMatch: { type: "ens", url: { $in: names } } } }] : [])],
      }, { limit: 2000 }).toArray();
      const memberships = await db.collection("wallet_list_memberships")
        .find({ listId: { $in: sharedIds }, walletId: { $in: candidates.map((c) => c._id) } }).toArray();
      const lists = await db.collection("lists").find({ _id: { $in: memberships.map((m) => m.listId) } }, { projection: { name: 1 } }).toArray();
      for (const l of lists) listNames.set(l._id.toString(), l.name);
      for (const m of memberships) viaList.set(m.walletId.toString(), m);
      visible = visible.concat(candidates.filter((c) => viaList.has(c._id.toString())));
    }
  }
  if (visible.length) {
    const links = await db.collection("wallet_entity_links").find({ walletId: { $in: visible.map((w) => w._id) } }).toArray();
    const entities = await db.collection("entities").find({ _id: { $in: links.map((l) => l.entityId) } }).toArray();
    const counts = await linkedCounts(entities.map((e) => e._id));
    for (const w of visible) {
      const isOwn = viewerId!.equals(w.ownerId);
      const link = links.find((l) => l.walletId.equals(w._id) && (isOwn || l.visibility !== "private"));
      const entity = link && entities.find((e) => e._id.equals(link.entityId));
      const listId = viaList.get(w._id.toString())?.listId?.toString();
      const listName = isOwn ? undefined : listNames.get(listId!);
      const source = isOwn ? "private" : "shared";
      const label: ResolvedLabel = {
        source, provenance: provenanceText(source, listName), label: w.displayLabel || entity?.name || "Untitled wallet",
        walletId: w._id.toString(), chain: w.chain, tags: w.tags ?? [], status: w.status, notes: w.notes, listName,
        shared: !isOwn, links: [...(w.links ?? []), ...(entity?.links ?? [])].map(linkView),
        entity: entity ? entityInfo(entity, counts) : undefined,
      };
      if (family.get(w.normalizedAddress) && fits(w)) out.get(w.normalizedAddress)!.push(label);
      for (const l of w.links ?? []) if (l.type === "ens" && out.has(l.url)) out.get(l.url)!.push(label);
    }
  }

  // 3: published public claims. Only the entity and the link are read, never the wallet's label or notes.
  if (norm.length) {
    const records = await db.collection("wallets").find({ normalizedAddress: { $in: norm } }, { projection: { normalizedAddress: 1, chain: 1 }, limit: 5000 }).toArray();
    const links = await db.collection("wallet_entity_links").find({ walletId: { $in: records.map((r) => r._id) }, visibility: "public" }).toArray();
    if (links.length) {
      const entities = await db.collection("entities").find({
        _id: { $in: links.map((l) => l.entityId) }, visibility: "public", "moderation.removedAt": null,
      }).toArray();
      const counts = await linkedCounts(entities.map((e) => e._id), ["public"]);
      for (const link of links) {
        const entity = entities.find((e) => e._id.equals(link.entityId));
        const record = records.find((r) => r._id.equals(link.walletId));
        if (!entity || !record || !fits(record)) continue;
        const source = entity.verification?.status === "verified" ? "verified" : "self_claimed";
        out.get(record.normalizedAddress)!.push({
          source, provenance: provenanceText(source), label: entity.name, chain: record.chain, tags: entity.tags ?? [],
          shared: false, links: (entity.links ?? []).map(linkView), entity: entityInfo(entity, counts),
        });
      }
    }
  }
  if (names.length) {
    const entities = await db.collection("entities").find({
      visibility: "public", "moderation.removedAt": null, links: { $elemMatch: { type: "ens", url: { $in: names } } },
    }).toArray();
    const counts = await linkedCounts(entities.map((e) => e._id), ["public"]);
    for (const entity of entities) {
      const source = entity.verification?.status === "verified" ? "verified" : "self_claimed";
      for (const l of entity.links) {
        if (l.type !== "ens" || !out.has(l.url)) continue;
        out.get(l.url)!.push({
          source, provenance: provenanceText(source), label: entity.name, chain: "ethereum", tags: entity.tags ?? [],
          shared: false, links: entity.links.map(linkView), entity: entityInfo(entity, counts),
        });
      }
    }
  }
  return [...out].map(([normalized, labels]) => ({ normalized, labels: sortLabels(labels) }));
}
