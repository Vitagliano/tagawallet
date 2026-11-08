import { z } from "zod";
import { ApiError, route } from "@/lib/api";
import { publicUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

/** Unlinks a sign-in method, as long as at least one way back in remains. */
export const DELETE = route(async ({ body, user }) => {
  const input = await body(z.object({ provider: z.enum(["google", "x", "wallet"]), address: z.string().max(120).optional() }));
  const identities = (user.identities ?? []) as { provider: string; subject: string }[];
  const keep = identities.filter((i) => !(i.provider === input.provider && (input.provider !== "wallet" || (i.subject === input.address || i.subject === input.address?.toLowerCase()))));
  if (keep.length === identities.length) throw new ApiError(404, "That sign-in method isn't linked.");
  if (!user.passwordHash && keep.length === 0) throw new ApiError(422, "Set a password or link another sign-in method first, so you can still get in.");
  const providers = [...new Set([...(user.passwordHash ? ["password"] : []), ...keep.map((i) => i.provider)])];
  const db = await getDb();
  await db.collection("users").updateOne({ _id: user._id }, { $set: { identities: keep, authProviders: providers, updatedAt: new Date() } });
  return { user: publicUser({ ...user, identities: keep, authProviders: providers } as typeof user) };
});
