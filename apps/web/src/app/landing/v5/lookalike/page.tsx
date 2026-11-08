import { currentUser } from "@/lib/session";
import { LookalikeLanding } from "@/components/landing/v5/lookalike";

export const metadata = { title: "Lookalike (v5)" };

export default async function Page() {
  return <LookalikeLanding signedIn={!!(await currentUser())} />;
}
