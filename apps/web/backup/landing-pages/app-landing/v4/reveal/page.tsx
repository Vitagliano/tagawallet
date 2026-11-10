import { currentUser } from "@/lib/session";
import { RevealLanding } from "@/components/landing/v4/reveal";

export const metadata = { title: "Reveal (v4)" };

export default async function Page() {
  return <RevealLanding signedIn={!!(await currentUser())} />;
}
