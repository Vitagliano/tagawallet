import { currentUser } from "@/lib/session";
import { Lookalike3Landing } from "@/components/landing/v5/lookalike-3";

export const metadata = { title: "Lookalike 3 (v5)" };

export default async function Page() {
  return <Lookalike3Landing signedIn={!!(await currentUser())} />;
}
