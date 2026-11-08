import { redirect } from "next/navigation";

/** Wallets open in a drawer over the Wallets page. Old links land there. */
export default async function Wallet({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/dashboard?w=${encodeURIComponent(id)}`);
}
