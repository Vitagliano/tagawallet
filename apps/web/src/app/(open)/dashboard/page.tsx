import { Suspense } from "react";
import { Home } from "@/components/home";
import { LockedDashboard } from "@/components/locked-dashboard";
import { currentUser } from "@/lib/session";

/** Home: one search/add bar over contacts, lists and the wallet book. Guests see a locked preview. */
export default async function Dashboard () {
  const user = await currentUser();
  if (!user) return <LockedDashboard />;
  return <Suspense><Home /></Suspense>;
}
