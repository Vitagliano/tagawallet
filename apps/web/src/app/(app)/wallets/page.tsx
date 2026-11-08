import { redirect } from "next/navigation";

/** Wallets live on home now. Keep old links (filters, search, open drawer) working. */
export default async function WalletsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const p = await searchParams;
  const next = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) if (typeof v === "string") next.set(k, v);
  const qs = next.toString();
  redirect(qs ? `/dashboard?${qs}` : "/dashboard");
}
