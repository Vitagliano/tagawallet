import { currentUser } from "@/lib/session";
import { InlineLanding } from "@/components/landing/v2/inline";

export const metadata = { title: "Inline (v2)" };

export default async function Page() {
  return <InlineLanding signedIn={!!(await currentUser())} />;
}
