import { currentUser } from "@/lib/session";
import { BlendLanding } from "@/components/landing/v6/blend";

export const metadata = { title: "Blend (v6)" };

export default async function Page() {
  return <BlendLanding signedIn={!!(await currentUser())} />;
}
