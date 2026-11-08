import { currentUser } from "@/lib/session";
import { SurfLanding } from "@/components/landing/v5/surf";

export const metadata = { title: "Surf (v5)" };

export default async function Page() {
  return <SurfLanding signedIn={!!(await currentUser())} />;
}
