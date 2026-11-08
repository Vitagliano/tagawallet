import { route, ser } from "@/lib/api";
import { accessibleLists, roleIn } from "@/lib/access";
import { publicUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { DEFAULT_SETTINGS } from "@/lib/settings";

/** What the tagging form needs: places a tag can go and entities it can attach to. */
export const GET = route(async ({ user }) => {
  const db = await getDb();
  const lists = (await accessibleLists(user._id, { name: 1, visibility: 1, ownerId: 1, collaborators: 1, archivedAt: 1 }))
    .filter((l) => !l.archivedAt && roleIn(l, user._id) !== "viewer")
    .map((l) => ({ _id: l._id, name: l.name, visibility: l.visibility }));
  const entities = await db.collection("entities").find({ ownerId: user._id }, { projection: { name: 1, type: 1 } }).sort({ updatedAt: -1 }).limit(200).toArray();
  return ser({
    user: publicUser(user), lists, entities, lastListId: user.lastListId ?? null,
    settings: { ...DEFAULT_SETTINGS, ...user.extensionSettings },
  });
}, { cors: true });
export { preflight as OPTIONS } from "@/lib/api";
