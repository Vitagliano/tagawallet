import { NextResponse } from "next/server";
import type { Document, ObjectId, WithId } from "mongodb";
import { ser } from "./api";
import { toCsv } from "./csv";
import { getDb } from "./db";

export const EXPORT_COLUMNS = ["address", "chain", "label", "status", "tags", "notes", "entities"];

/**
 * Wallets as export rows. Every linked person or project is listed, separated by "; ".
 * Links on someone else's wallet show only when they aren't private.
 */
export async function exportRows(wallets: WithId<Document>[], viewerId: ObjectId) {
  const db = await getDb();
  const links = await db.collection("wallet_entity_links").find({ walletId: { $in: wallets.map((w) => w._id) } }).toArray();
  const entities = await db.collection("entities").find({ _id: { $in: links.map((l) => l.entityId) } }, { projection: { name: 1 } }).toArray();
  const nameOf = new Map(entities.map((e) => [e._id.toString(), String(e.name)]));
  return wallets.map((w) => {
    const own = w.ownerId.equals(viewerId);
    const names = links
      .filter((l) => l.walletId.equals(w._id) && (own || l.visibility !== "private"))
      .map((l) => nameOf.get(l.entityId.toString()))
      .filter((n): n is string => !!n);
    return {
      address: w.address, chain: w.chain, label: w.displayLabel, status: w.status, notes: w.notes,
      tags: (w.tags ?? []).join("; "), entities: [...new Set(names)].join("; "),
    };
  });
}

export const safeFilename = (name: string, fallback: string) => String(name).replace(/[^a-z0-9-_ ]/gi, "").trim().replace(/\s+/g, "-") || fallback;

/** A download in the asked-for format. `meta` sits beside the wallets in JSON. */
export function exportResponse(format: string | null, filename: string, rows: Record<string, unknown>[], meta: Record<string, unknown> = {}) {
  if (format === "csv") {
    return new NextResponse(toCsv(EXPORT_COLUMNS, rows), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}.csv"` },
    });
  }
  return new NextResponse(JSON.stringify(ser({ ...meta, wallets: rows }), null, 2), {
    headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="${filename}.json"` },
  });
}
