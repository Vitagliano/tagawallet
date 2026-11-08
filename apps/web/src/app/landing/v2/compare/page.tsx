import { currentUser } from "@/lib/session";
import { CompareLanding } from "@/components/landing/v2/compare";

export const metadata = { title: "Compare (v2)" };

export default async function Page() {
  return <CompareLanding signedIn={!!(await currentUser())} />;
}
