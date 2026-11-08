import { Suspense } from "react";
import { Home } from "@/components/home";

/** Home: one search/add bar over contacts, lists and the wallet book. */
export default function Dashboard() {
  return <Suspense><Home /></Suspense>;
}
