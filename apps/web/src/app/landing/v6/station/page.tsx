import { currentUser } from "@/lib/session";
import { StationLanding } from "@/components/landing/v6/station";

export const metadata = { title: "Station (v6)" };

export default async function Page() {
  return <StationLanding signedIn={!!(await currentUser())} />;
}
