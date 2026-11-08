import { redirect } from "next/navigation";

/** Search lives in the bar on home and in ⌘K. Old links keep working. */
export default async function Search({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  redirect(q ? `/dashboard?q=${encodeURIComponent(q)}` : "/dashboard");
}
