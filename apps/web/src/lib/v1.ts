import type { Document } from "mongodb";

/** The public shape of a wallet. Stable field names, no internal ids beyond `id`. */
export function v1Wallet(w: Document) {
  return {
    id: String(w._id), address: w.address, chain: w.chain, label: w.displayLabel ?? "", status: w.status ?? "none",
    tags: w.tags ?? [], notes: w.notes ?? "", links: (w.links ?? []).map((l: Document) => ({ type: l.type, url: l.url, label: l.label })),
    own: !!w.own,
    lists: (w.lists ?? []).map((l: Document) => ({ id: String(l._id), name: l.name })),
    entities: (w.entities ?? []).map((e: Document) => ({ id: String(e._id), name: e.name, type: e.type, relationship: e.relationship })),
    createdAt: w.createdAt?.toISOString?.() ?? w.createdAt, updatedAt: w.updatedAt?.toISOString?.() ?? w.updatedAt,
  };
}
