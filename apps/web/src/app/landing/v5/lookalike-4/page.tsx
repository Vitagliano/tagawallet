import { currentUser } from "@/lib/session";
import { Lookalike4Landing } from "@/components/landing/v5/lookalike-4";

export const metadata = { title: "Lookalike 4 (v5)" };

export default async function Page() {
  return <Lookalike4Landing signedIn={!!(await currentUser())} />;
}
