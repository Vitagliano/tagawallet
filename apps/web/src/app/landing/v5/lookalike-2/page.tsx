import { currentUser } from "@/lib/session";
import { Lookalike2Landing } from "@/components/landing/v5/lookalike-2";

export const metadata = { title: "Lookalike 2 (v5)" };

export default async function Page() {
  return <Lookalike2Landing signedIn={!!(await currentUser())} />;
}
