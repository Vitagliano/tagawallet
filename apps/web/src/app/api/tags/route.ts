import { route } from "@/lib/api";
import { getDb } from "@/lib/db";

/** Every tag this person has used, for suggestions. */
export const GET = route(async ({ user }) => {
  const db = await getDb();
  const tags = (await db.collection("wallets").distinct("tags", { ownerId: user._id })) as string[];
  return { tags: tags.filter(Boolean).sort().slice(0, 500) };
});
