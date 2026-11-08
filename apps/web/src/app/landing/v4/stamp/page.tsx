import { currentUser } from "@/lib/session";
import { StampLanding } from "@/components/landing/v4/stamp";

export const metadata = { title: "Stamp (v4)" };

export default async function Page() {
  return <StampLanding signedIn={!!(await currentUser())} />;
}
