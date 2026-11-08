import { currentUser } from "@/lib/session";
import { LensLanding } from "@/components/landing/v1/lens";

export const metadata = { title: "Lens (v1)" };

export default async function Page() {
  return <LensLanding signedIn={!!(await currentUser())} />;
}
