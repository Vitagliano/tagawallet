import { currentUser } from "@/lib/session";
import { HangLanding } from "@/components/landing/v4/hang";

export const metadata = { title: "Hang (v4)" };

export default async function Page() {
  return <HangLanding signedIn={!!(await currentUser())} />;
}
