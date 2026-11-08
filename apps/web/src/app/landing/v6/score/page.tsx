import { currentUser } from "@/lib/session";
import { ScoreLanding } from "@/components/landing/v6/score";

export const metadata = { title: "Score (v6)" };

export default async function Page() {
  return <ScoreLanding signedIn={!!(await currentUser())} />;
}
