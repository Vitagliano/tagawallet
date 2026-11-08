import { ObjectId, type Document } from "mongodb";
import { getDb } from "./db";
import { collaboratorListIds, getList, getOwnEntity } from "./access";

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Case-insensitive substring search scoped to the ownerId index, which keeps it fast at
 * 10k+ wallets per user. Scope comes first: nothing outside the viewer's records is examined.
 */
/** chain/tag narrow to one value; chains/tags match any of several (from "a,b" or repeated params). */
export interface WalletFilters { chain?: string; chains?: string[]; listId?: ObjectId; tag?: string; tags?: string[]; status?: string; statuses?: string[]; entityId?: ObjectId; unfiled?: boolean }

/** Every value of a repeatable, comma-separated query param, de-duplicated. */
const many = (p: URLSearchParams, key: string, lower = false) =>
  [...new Set(p.getAll(key).flatMap((v) => v.split(",")).map((v) => (lower ? v.trim().toLowerCase() : v.trim())).filter(Boolean))].slice(0, 50);

/** The wallet filters from a query string, after checking access to any list or entity named. */
export async function walletFiltersFrom(p: URLSearchParams, userId: ObjectId): Promise<WalletFilters> {
  const list = p.get("list"), entity = p.get("entity");
  // unlinked=1 kept as an alias for old People-home links.
  const unfiled = p.get("unfiled") === "1" || p.get("unfiled") === "true"
    || p.get("unlinked") === "1" || p.get("unlinked") === "true";
  return {
    chains: many(p, "chain"), tags: many(p, "tag", true), statuses: many(p, "status"),
    listId: list ? (await getList(list, userId)).list._id : undefined,
    entityId: entity ? (await getOwnEntity(entity, userId))._id : undefined,
    unfiled,
  };
}

export async function searchWallets(userId: ObjectId, q: string, filters: WalletFilters | string | undefined, limit: number) {
  const db = await getDb();
  return db.collection("wallets").find(await walletQuery(userId, q, filters)).sort({ updatedAt: -1 }).limit(limit).toArray();
}

export const WALLET_SORTS = { updated: { updatedAt: -1 }, created: { createdAt: -1 }, name: { displayLabel: 1, _id: 1 } } as const;
export type WalletSort = keyof typeof WALLET_SORTS;

/** One page of matches plus the total, for paginated tables. */
export async function searchWalletsPage(userId: ObjectId, q: string, filters: WalletFilters, opts: { limit: number; offset: number; sort: WalletSort }) {
  const db = await getDb();
  const query = await walletQuery(userId, q, filters);
  const [wallets, total] = await Promise.all([
    db.collection("wallets").find(query).sort({ ...WALLET_SORTS[opts.sort] }).skip(opts.offset).limit(opts.limit).toArray(),
    db.collection("wallets").countDocuments(query),
  ]);
  return { wallets, total };
}

/** The Mongo filter for a wallet search, scoped to what the viewer can see. */
async function walletQuery(userId: ObjectId, q: string, filters: WalletFilters | string | undefined): Promise<Document> {
  const f: WalletFilters = typeof filters === "string" ? { chain: filters } : filters ?? {};
  const chain = f.chain;
  const db = await getDb();
  const sharedLists = await collaboratorListIds(userId);
  const sharedIds = sharedLists.length
    ? (await db.collection("wallet_list_memberships").find({ listId: { $in: sharedLists } }, { projection: { walletId: 1 } }).toArray()).map((m) => m.walletId)
    : [];
  const scope: Document = { $or: [{ ownerId: userId }, { _id: { $in: sharedIds } }] };
  const and: Document[] = [scope];
  const chains = [...(chain ? [chain] : []), ...(f.chains ?? [])];
  const tags = [...(f.tag ? [f.tag] : []), ...(f.tags ?? [])];
  if (chains.length) and.push({ chain: { $in: chains } });
  if (tags.length) and.push({ tags: { $in: tags } });
  const statuses = [...(f.status ? [f.status] : []), ...(f.statuses ?? [])];
  // "none" means no status set, which is stored as "none" or left out.
  if (statuses.length) and.push({ $or: statuses.map((s) => (s === "none" ? { status: { $in: ["none", null] } } : { status: s })) });
  // Callers check access to the list or entity first. These only narrow what the scope already allows.
  if (f.listId) {
    const ids = (await db.collection("wallet_list_memberships").find({ listId: f.listId }, { projection: { walletId: 1 } }).toArray()).map((m) => m.walletId);
    and.push({ _id: { $in: ids } });
  }
  if (f.entityId) {
    const ids = (await db.collection("wallet_entity_links").find({ entityId: f.entityId }, { projection: { walletId: 1 } }).toArray()).map((l) => l.walletId);
    and.push({ _id: { $in: ids } });
  }
  if (f.unfiled) {
    // Nowhere: not on a person/project and not in any list. An X link alone doesn't file it.
    const ownIds = (await db.collection("wallets").find({ ownerId: userId }, { projection: { _id: 1 } }).toArray()).map((w) => w._id);
    const [entityIds, listIds] = ownIds.length
      ? await Promise.all([
        db.collection("wallet_entity_links").distinct("walletId", { walletId: { $in: ownIds } }),
        db.collection("wallet_list_memberships").distinct("walletId", { walletId: { $in: ownIds } }),
      ])
      : [[], []];
    const filed = new Set([...entityIds, ...listIds].map((x) => x.toString()));
    and.push({ ownerId: userId, _id: { $in: ownIds.filter((id) => !filed.has(id.toString())) } });
  }
  const term = q.trim();
  if (term) {
    const re = { $regex: escape(term), $options: "i" };
    const or: Document[] = [
      { normalizedAddress: re }, { displayLabel: re }, { notes: re }, { tags: re }, { chain: re }, { status: re }, { "links.url": re }, { "links.label": re },
    ];
    // Wallets reached through a matching entity or list count as matches too.
    const entities = await db.collection("entities").find({ ownerId: userId, $or: [{ name: re }, { "links.url": re }, { tags: re }] }, { projection: { _id: 1 } }).limit(500).toArray();
    if (entities.length) {
      const links = await db.collection("wallet_entity_links").find({ entityId: { $in: entities.map((e) => e._id) } }, { projection: { walletId: 1 } }).toArray();
      or.push({ _id: { $in: links.map((l) => l.walletId) } });
    }
    const lists = await db.collection("lists").find({
      deletedAt: null, name: re, $or: [{ ownerId: userId }, { "collaborators.userId": userId }],
    }, { projection: { _id: 1 } }).limit(100).toArray();
    if (lists.length) {
      const members = await db.collection("wallet_list_memberships").find({ listId: { $in: lists.map((l) => l._id) } }, { projection: { walletId: 1 } }).limit(20000).toArray();
      or.push({ _id: { $in: members.map((m) => m.walletId) } });
    }
    and.push({ $or: or });
  }
  return { $and: and };
}

export async function searchEntities(userId: ObjectId, q: string, limit: number) {
  const db = await getDb();
  const term = q.trim();
  const filter: Document = { ownerId: userId };
  if (term) {
    const re = { $regex: escape(term), $options: "i" };
    filter.$or = [{ name: re }, { description: re }, { tags: re }, { "links.url": re }, { "links.label": re }];
  }
  return db.collection("entities").find(filter).sort({ updatedAt: -1 }).limit(limit).toArray();
}
