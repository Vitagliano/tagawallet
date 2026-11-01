import { NextResponse } from "next/server";
import { route, ser } from "@/lib/api";
import { getList } from "@/lib/access";
import { getDb } from "@/lib/db";
import { toCsv } from "@/lib/csv";

export const GET = route<{ id: string }>(async ({ user, params, req }) => {
  const { list } = await getList(params.id, user._id);
  const db = await getDb();
  const members = await db.collection("wallet_list_memberships").find({ listId: list._id }).toArray();
  const wallets = await db.collection("wallets").find({ _id: { $in: members.map((m) => m.walletId) } }).toArray();
  const links = await db.collection("wallet_entity_links").find({ walletId: { $in: wallets.map((w) => w._id) } }).toArray();
  const entities = await db.collection("entities").find({ _id: { $in: links.map((l) => l.entityId) } }, { projection: { name: 1 } }).toArray();
  const rows = wallets.map((w) => {
    const own = w.ownerId.equals(user._id);
    const link = links.find((l) => l.walletId.equals(w._id) && (own || l.visibility !== "private"));
    return {
      address: w.address, chain: w.chain, label: w.displayLabel, status: w.status, notes: w.notes,
      tags: (w.tags ?? []).join("; "), entity: link ? entities.find((e) => e._id.equals(link.entityId))?.name ?? "" : "",
    };
  });
  const safeName = String(list.name).replace(/[^a-z0-9-_ ]/gi, "").trim().replace(/\s+/g, "-") || "list";
  if (req.nextUrl.searchParams.get("format") === "csv") {
    return new NextResponse(toCsv(["address", "chain", "label", "status", "tags", "notes", "entity"], rows), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${safeName}.csv"` },
    });
  }
  return new NextResponse(JSON.stringify(ser({ list: { name: list.name, description: list.description }, wallets: rows }), null, 2), {
    headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="${safeName}.json"` },
  });
}, { rate: { name: "list-export", limit: 60, windowSec: 3600 } });
