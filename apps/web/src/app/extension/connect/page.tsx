import { Suspense } from "react";
import { requireUser } from "@/lib/session";
import { ConnectExtension } from "./connect";

export const metadata = { title: "Connect the extension", robots: { index: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ ext?: string }> }) {
  const { ext } = await searchParams;
  await requireUser(`/extension/connect${ext ? `?ext=${encodeURIComponent(ext)}` : ""}`);
  return <Suspense><ConnectExtension /></Suspense>;
}
