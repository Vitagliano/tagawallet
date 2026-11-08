import { currentUser } from "@/lib/session";
import { FixerLanding } from "@/components/landing/v6/fixer";

export const metadata = { title: "Fixer (v6)" };

export default async function Page() {
  return <FixerLanding signedIn={!!(await currentUser())} />;
}
