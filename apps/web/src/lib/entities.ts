import { requireVerifiedEmail } from "./email-verification";
import type { Document, ObjectId } from "mongodb";
import { sanitizeUrl } from "@tagawallet/shared";
import { ApiError } from "./api";
import { getDb } from "./db";
import { publishers } from "./publishers";

export function avatarOrThrow(value: string | undefined) {
  if (!value) return null;
  const url = sanitizeUrl(value);
  if (!url || !url.startsWith("https://")) throw new ApiError(422, "The logo must be an https URL.", { fields: { avatarUrl: "Use an https image URL." } });
  return url;
}

const PERSONAL_INFO = /[\w.+-]+@[\w-]+\.[\w.]+|(?:\+?\d[\s().-]?){10,}/;

/** The publishing gate. Safe attribution rules live here so every route shares them. */
export async function assertPublishable(entity: Document, owner: Document, opts: { publicFigure?: boolean } = {}) {
  requireVerifiedEmail(owner, "publishing a profile");
  if (owner.restrictedAt) throw new ApiError(403, "Publishing is disabled on this account after a moderation review.");
  if (entity.moderation?.removedAt) throw new ApiError(403, "This profile was removed by moderators and can't be republished.");
  // Publishing says "these are my names for these wallets", not "this is me". For a person that could expose someone,
  // so it needs the publisher to confirm the person is a public figure whose wallets are already public.
  if (entity.type === "individual" && entity.verification?.status !== "verified" && !opts.publicFigure) {
    throw new ApiError(422, "Confirm this person is a public figure and these wallets are already publicly known to be theirs.");
  }
  if (PERSONAL_INFO.test(entity.description ?? "")) {
    throw new ApiError(422, "Remove email addresses and phone numbers from the description. Public profiles can't include personal contact details.");
  }
}

export async function uniqueSlug(name: string, selfId: ObjectId) {
  const db = await getDb();
  const base = name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "profile";
  for (let i = 0; i < 50; i++) {
    const slug = i ? `${base}-${i + 1}` : base;
    const clash = await db.collection("entities").findOne({ slug, _id: { $ne: selfId } }, { projection: { _id: 1 } });
    if (!clash) return slug;
  }
  return `${base}-${selfId.toString().slice(-6)}`;
}

/** Everything the public can see about a profile. Built by allowlist, so private fields can't slip in. */
export async function publicProfile(slug: string) {
  const db = await getDb();
  const entity = await db.collection("entities").findOne({ slug, visibility: "public", "moderation.removedAt": null });
  if (!entity) return null;
  const links = await db.collection("wallet_entity_links").find({ entityId: entity._id, visibility: "public" }).toArray();
  const wallets = await db.collection("wallets").find({ _id: { $in: links.map((l) => l.walletId) } }, { projection: { address: 1, chain: 1 } }).toArray();
  const publishedBy = (await publishers([entity.ownerId])).get(entity.ownerId.toString()) ?? { name: "A TagAWallet user" };
  return {
    publishedBy,
    id: entity._id.toString(), slug: entity.slug as string, name: entity.name as string, type: entity.type as string,
    description: (entity.description ?? "") as string, avatarUrl: (entity.avatarUrl ?? null) as string | null, tags: (entity.tags ?? []) as string[],
    indexable: !!entity.allowIndexing, annotation: (entity.moderation?.annotation ?? null) as string | null,
    // "verified" only for profiles verified before publishing meant attribution; everything else is published by someone.
    verification: (entity.verification?.status === "verified" ? "verified" : "community") as string,
    verifiedAt: entity.verification?.verifiedAt?.toISOString?.() ?? null,
    proofs: (entity.verification?.proofs ?? []) as { method: string; target: string }[],
    links: (entity.links ?? []).map((l: Document) => ({ type: l.type as string, url: l.url as string, label: (l.label ?? "") as string, status: (l.status ?? "source") as string })),
    wallets: links.flatMap((l) => {
      const w = wallets.find((x) => x._id.equals(l.walletId));
      if (!w) return [];
      return [{
        linkId: l._id.toString(), address: w.address as string, chain: w.chain as string, relationship: l.relationship as string,
        // Provenance: how the owner backed this attribution up.
        source: (l.evidence ?? []).some((e: Document) => e.verifiedAt) ? "Verified by signature" : `Published by ${publishedBy.name}`,
      }];
    }),
  };
}
