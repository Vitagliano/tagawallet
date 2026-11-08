import { currentUser } from "@/lib/session";
import { GraphLanding } from "@/components/landing/v1/graph";

export const metadata = { title: "Graph (v1)" };

export default async function Page() {
  return <GraphLanding signedIn={!!(await currentUser())} />;
}
