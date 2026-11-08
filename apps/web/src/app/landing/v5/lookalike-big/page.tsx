import { currentUser } from "@/lib/session";
import { LookalikeBigLanding } from "@/components/landing/v5/lookalike-big";

export const metadata = { title: "Lookalike Big (v5)" };

export default async function Page() {
  return <LookalikeBigLanding signedIn={!!(await currentUser())} />;
}
