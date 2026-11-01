import { NextResponse } from "next/server";
import { route, ser } from "@/lib/api";
import { getDb } from "@/lib/db";

export const GET = route(async ({ user }) => {
  const db = await getDb();
  const id = user._id;
  const [wallets, lists, entities] = await Promise.all(["wallets", "lists", "entities"].map((c) => db.collection(c).find({ ownerId: id }).toArray()));
  const [memberships, links] = await Promise.all([
    db.collection("wallet_list_memberships").find({ listId: { $in: lists!.map((l) => l._id) } }).toArray(),
    db.collection("wallet_entity_links").find({ walletId: { $in: wallets!.map((w) => w._id) } }).toArray(),
  ]);
  const { passwordHash: _omit, ...profile } = user;
  return new NextResponse(JSON.stringify(ser({ exportedAt: new Date(), profile, lists, wallets, entities, memberships, links }), null, 2), {
    headers: { "Content-Type": "application/json", "Content-Disposition": 'attachment; filename="tagawallet-export.json"' },
  });
}, { rate: { name: "export", limit: 20, windowSec: 3600 } });
