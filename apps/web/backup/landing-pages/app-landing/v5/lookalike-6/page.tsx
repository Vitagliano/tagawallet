import { currentUser } from "@/lib/session";
import { Lookalike6Landing } from "@/components/landing/v5/lookalike-6";

export const metadata = { title: "Lookalike 6 (v5)" };

export default async function Page() {
  return <Lookalike6Landing signedIn={!!(await currentUser())} />;
}
