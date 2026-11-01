import { notFound, publicRoute } from "@/lib/api";
import { publicProfile } from "@/lib/entities";

export const GET = publicRoute<{ slug: string }>(async ({ params }) => {
  const profile = await publicProfile(params.slug);
  if (!profile) throw notFound("Profile not found");
  const { indexable: _i, ...rest } = profile;
  return rest;
}, { rate: { name: "public-profile", limit: 120, windowSec: 60 } });
