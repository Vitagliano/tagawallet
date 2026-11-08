import { currentUser } from "@/lib/session";
import { YoursLanding } from "@/components/landing/v3/yours";

export const metadata = { title: "Yours (v3)" };

export default async function Page() {
  return <YoursLanding signedIn={!!(await currentUser())} />;
}
