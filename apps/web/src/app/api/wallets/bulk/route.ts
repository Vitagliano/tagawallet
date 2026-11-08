import { z } from "zod";
import type { Document, WithId } from "mongodb";
import { objectId } from "@tagawallet/shared";
import { ApiError, route } from "@/lib/api";
import { getList, getOwnEntity, getWallet, logActivity } from "@/lib/access";
import { getDb } from "@/lib/db";
import { addToList } from "@/lib/wallets";

const tag = z.string().trim().min(1).max(40).transform((t) => t.toLowerCase());
const input = z.object({ ids: z.array(objectId).min(1).max(500) }).and(z.discriminatedUnion("op", [
  z.object({ op: z.literal("addTag"), tag }),
  z.object({ op: z.literal("removeTag"), tag }),
  z.object({ op: z.literal("setStatus"), status: z.string().trim().max(30) }),
  z.object({ op: z.literal("setNotes"), mode: z.enum(["append", "replace"]), text: z.string().trim().max(5000) }),
  z.object({ op: z.literal("move"), fromListId: objectId, toListId: objectId }),
  z.object({ op: z.literal("linkEntity"), entityId: objectId }),
]));

/**
 * One change to many wallets. Access is checked per wallet, so a selection that mixes your own
 * wallets with view-only shared ones changes what it can and reports the rest.
 */
export const POST = route(async ({ user, body }) => {
  const req = await body(input);
  const db = await getDb();
  const ids = [...new Set(req.ids)];
  const wallets: WithId<Document>[] = [];
  const failed: { id: string; error: string }[] = [];
  for (const id of ids) {
    try {
      const { wallet, own } = await getWallet(id, user._id, true);
      // A wallet only its owner can link to their own people and projects.
      if (req.op === "linkEntity" && !own) throw new ApiError(403, "Only the person who added a wallet can link it.");
      wallets.push(wallet);
    } catch (err) {
      failed.push({ id, error: (err as Error).message });
    }
  }
  const _ids = wallets.map((w) => w._id);
  const now = new Date();
  switch (req.op) {
    case "addTag":
      await db.collection("wallets").updateMany({ _id: { $in: _ids } }, { $addToSet: { tags: req.tag }, $set: { updatedAt: now } });
      break;
    case "removeTag":
      await db.collection("wallets").updateMany({ _id: { $in: _ids } }, { $pull: { tags: req.tag } as never, $set: { updatedAt: now } });
      break;
    case "setStatus":
      await db.collection("wallets").updateMany({ _id: { $in: _ids } }, { $set: { status: req.status || "none", updatedAt: now } });
      break;
    case "setNotes":
      for (const w of wallets) {
        const notes = req.mode === "replace" || !w.notes ? req.text : `${w.notes}\n${req.text}`;
        await db.collection("wallets").updateOne({ _id: w._id }, { $set: { notes: notes.slice(0, 5000), updatedAt: now } });
      }
      break;
    case "move": {
      if (req.fromListId === req.toListId) throw new ApiError(422, "Pick a different list to move to.");
      const [{ list: from }, { list: to }] = await Promise.all([getList(req.fromListId, user._id, "editor"), getList(req.toListId, user._id, "editor")]);
      for (const w of wallets) await addToList(to._id, w._id, user._id);
      await db.collection("wallet_list_memberships").deleteMany({ listId: from._id, walletId: { $in: _ids } });
      if (_ids.length) {
        await logActivity(to._id, user._id, "moved wallets in", `${_ids.length} from ${from.name}`);
        await logActivity(from._id, user._id, "moved wallets out", `${_ids.length} to ${to.name}`);
      }
      break;
    }
    case "linkEntity": {
      const entity = await getOwnEntity(req.entityId, user._id);
      for (const w of wallets) {
        await db.collection("wallet_entity_links").updateOne({ walletId: w._id, entityId: entity._id }, {
          $setOnInsert: { relationship: "associated", visibility: "private", source: "user", claimedBy: user._id, evidence: [], createdAt: now, updatedAt: now },
        }, { upsert: true });
      }
      break;
    }
  }
  return { changed: wallets.length, failed };
}, { rate: { name: "wallet-bulk", limit: 120, windowSec: 60 } });
