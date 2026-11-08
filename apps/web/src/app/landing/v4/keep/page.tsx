import { currentUser } from "@/lib/session";
import { KeepLanding } from "@/components/landing/v4/keep";

export const metadata = { title: "Keep (v4)" };

export default async function Page() {
  return <KeepLanding signedIn={!!(await currentUser())} />;
}
