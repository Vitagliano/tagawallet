import { currentUser } from "@/lib/session";
import { NightLanding } from "@/components/landing/v6/night";

export const metadata = { title: "Night (v6)" };

export default async function Page() {
  return <NightLanding signedIn={!!(await currentUser())} />;
}
