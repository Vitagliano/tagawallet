import { ApiError, apiKeyRoute } from "@/lib/api";
import { inferFamily, normalizeAddress } from "@tagawallet/shared";
import { resolveAddresses } from "@/lib/resolve";

const MAX = 200;

/**
 * GET /api/v1/lookup?addresses=0x…,0x…: the same labels the extension shows, with the same privacy rules.
 * Your own tags, lists shared with you, and published profiles. Nobody else's private records.
 */
export const GET = apiKeyRoute(async ({ req, user }) => {
  const raw = (req.nextUrl.searchParams.get("addresses") ?? "").split(",").map((a) => a.trim()).filter(Boolean);
  if (!raw.length) throw new ApiError(422, "Pass ?addresses= with one or more comma-separated addresses or .eth names.");
  if (raw.length > MAX) throw new ApiError(422, `Look up at most ${MAX} addresses at a time.`);
  const queries = raw.map((a) => {
    if (/\.(eth|sol)$/i.test(a)) return { input: a, normalized: a.toLowerCase(), kind: a.toLowerCase().endsWith(".eth") ? "ens" : "sns" };
    const family = inferFamily(a);
    if (!family) throw new ApiError(422, `“${a.slice(0, 64)}” isn't an address TagAWallet recognises.`);
    return { input: a, normalized: normalizeAddress(a, family), kind: family };
  });
  const results = await resolveAddresses(queries.map(({ normalized, kind }) => ({ normalized, kind })), user._id);
  const byKey = new Map(results.map((r) => [r.normalized, r]));
  return {
    results: queries.map((q) => {
      const r = byKey.get(q.normalized);
      return {
        address: q.input, ...(r?.address ? { resolvedAddress: r.address } : {}),
        labels: (r?.labels ?? []).map((l) => ({
          label: l.label, source: l.source, provenance: l.provenance, chain: l.chain, status: l.status ?? "none", tags: l.tags,
          entity: l.entity ? { id: l.entity.id, name: l.entity.name, verification: l.entity.verification, slug: l.entity.slug ?? null } : null,
          links: l.links,
        })),
      };
    }),
  };
}, { name: "v1-lookup", limit: 120, windowSec: 60 });
