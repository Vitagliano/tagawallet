import { currentUser } from "@/lib/session";
import { SlotsLanding } from "@/components/landing/v6/slots";

export const metadata = { title: "Slots (v6)" };

export default async function Page() {
  return <SlotsLanding signedIn={!!(await currentUser())} />;
}
