import { route, ser } from "@/lib/api";
import { accessibleLists } from "@/lib/access";
import { getDb } from "@/lib/db";
import { hydrateWallets } from "@/lib/wallets";

export const GET = route(async ({ user }) => {
  const db = await getDb();
  const id = user._id;
  const [wallets, entities, walletCount, entityCount, linkedEntity, extension, lists] = await Promise.all([
    db.collection("wallets").find({ ownerId: id }).sort({ updatedAt: -1 }).limit(8).toArray(),
    db.collection("entities").find({ ownerId: id }).sort({ updatedAt: -1 }).limit(6).toArray(),
    db.collection("wallets").countDocuments({ ownerId: id }),
    db.collection("entities").countDocuments({ ownerId: id }),
    db.collection("entities").findOne({ ownerId: id, "links.0": { $exists: true } }, { projection: { _id: 1 } }),
    db.collection("events").findOne({ userId: id, name: "extension_connected" }, { projection: { _id: 1 } }),
    accessibleLists(id, { name: 1 }),
  ]);
  return ser({
    wallets: await hydrateWallets(wallets, id), entities, counts: { wallets: walletCount, entities: entityCount, lists: lists.length },
    onboarding: { list: lists.length > 0, wallet: walletCount > 0, entity: entityCount > 0, link: !!linkedEntity, extension: !!extension },
  });
});
