import { currentUser } from "@/lib/session";
import { TryLanding } from "@/components/landing/v4/try";

export const metadata = { title: "Try (v4)" };

export default async function Page() {
  return <TryLanding signedIn={!!(await currentUser())} />;
}
