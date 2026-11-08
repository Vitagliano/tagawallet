import { currentUser } from "@/lib/session";
import { LiningLanding } from "@/components/landing/v6/lining";

export const metadata = { title: "Lining (v6)" };

export default async function Page() {
  return <LiningLanding signedIn={!!(await currentUser())} />;
}
