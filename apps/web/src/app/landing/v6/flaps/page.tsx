import { currentUser } from "@/lib/session";
import { FlapsLanding } from "@/components/landing/v6/flaps";

export const metadata = { title: "Flaps (v6)" };

export default async function Page() {
  return <FlapsLanding signedIn={!!(await currentUser())} />;
}
