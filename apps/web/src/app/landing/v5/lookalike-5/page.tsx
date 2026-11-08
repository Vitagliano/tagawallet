import { currentUser } from "@/lib/session";
import { Lookalike5Landing } from "@/components/landing/v5/lookalike-5";

export const metadata = { title: "Lookalike 5 (v5)" };

export default async function Page() {
  return <Lookalike5Landing signedIn={!!(await currentUser())} />;
}
