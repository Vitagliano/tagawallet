import { currentUser } from "@/lib/session";
import { LightLanding } from "@/components/landing/v3/light";

export const metadata = { title: "Light (v3)" };

export default async function Page() {
  return <LightLanding signedIn={!!(await currentUser())} />;
}
