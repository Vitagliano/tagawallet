import { currentUser } from "@/lib/session";
import { NamesLanding } from "@/components/landing/v3/names";

export const metadata = { title: "Names (v3)" };

export default async function Page() {
  return <NamesLanding signedIn={!!(await currentUser())} />;
}
