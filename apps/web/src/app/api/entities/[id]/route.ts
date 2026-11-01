import { entityUpdateSchema } from "@tagawallet/shared";
import { route, ser } from "@/lib/api";
import { getOwnEntity, getVisibleEntity, trackFirst } from "@/lib/access";
import { getDb } from "@/lib/db";
import { avatarOrThrow } from "@/lib/entities";
import { hydrateWallets } from "@/lib/wallets";

type P = { id: string };

export const GET = route<P>(async ({ user, params }) => {
  const { entity, own } = await getVisibleEntity(params.id, user._id);
  const db = await getDb();
  const links = await db.collection("wallet_entity_links").find({ entityId: entity._id, ...(own ? {} : { visibility: { $ne: "private" } }) }).toArray();
  const wallets = await db.collection("wallets").find({ _id: { $in: links.map((l) => l.walletId) } }).toArray();
  // Non-owners get the claim but not the owner's private record for a wallet.
  const visible = own ? wallets : wallets.map((w) => ({ ...w, notes: "", displayLabel: "", tags: [], links: [] }));
  const hydrated = await hydrateWallets(visible, user._id);
  const verifications = own ? await db.collection("verifications").find({ entityId: entity._id }).sort({ createdAt: -1 }).limit(10).toArray() : [];
  const { ownerId: _o, moderation, ...rest } = entity;
  return ser({
    ...rest, own, moderation: own ? moderation : undefined, verifications,
    wallets: hydrated.map((w) => {
      const l = links.find((x) => x.walletId.equals(w._id))!;
      return { ...w, relationship: l.relationship, linkVisibility: l.visibility, evidence: l.evidence ?? [] };
    }),
  });
});

export const PATCH = route<P>(async ({ user, params, body }) => {
  const input = await body(entityUpdateSchema);
  const entity = await getOwnEntity(params.id, user._id);
  const db = await getDb();
  const set: Record<string, unknown> = { updatedAt: new Date() };
  for (const [k, v] of Object.entries(input)) if (v !== undefined) set[k] = v;
  if (input.avatarUrl !== undefined) set.avatarUrl = avatarOrThrow(input.avatarUrl);
  // Renaming or relinking changes what a verification vouched for, so it no longer stands.
  const proofs: { target: string }[] = entity.verification?.proofs ?? [];
  const proofGone = !!input.links && proofs.some((p) => !input.links!.some((l) => l.url === p.target || new URL(l.url.startsWith("http") ? l.url : "https://x.invalid").hostname === new URL(p.target.startsWith("http") ? p.target : "https://x.invalid").hostname));
  const claimChanged = (input.name && input.name !== entity.name) || proofGone;
  if (claimChanged && entity.verification?.status === "verified") {
    set.verification = { status: entity.visibility === "public" ? "self_claimed" : "unverified", verifiedAt: null, verifiedBy: null, methods: [], proofs: [] };
  }
  await db.collection("entities").updateOne({ _id: entity._id }, { $set: set });
  if (input.links?.length) await trackFirst("first_social_link_added", user._id);
  return ser({ ...entity, ...set });
});

export const DELETE = route<P>(async ({ user, params }) => {
  const entity = await getOwnEntity(params.id, user._id);
  const db = await getDb();
  await Promise.all([
    db.collection("wallet_entity_links").deleteMany({ entityId: entity._id }),
    db.collection("verifications").deleteMany({ entityId: entity._id }),
    db.collection("entities").deleteOne({ _id: entity._id }),
  ]);
  return { ok: true };
});
