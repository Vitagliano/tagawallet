import { currentUser } from "@/lib/session";
import { BoothLanding } from "@/components/landing/v6/booth";

export const metadata = { title: "Booth (v6)" };

export default async function Page() {
  return <BoothLanding signedIn={!!(await currentUser())} />;
}
