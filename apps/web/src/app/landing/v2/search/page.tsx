import { currentUser } from "@/lib/session";
import { SearchLanding } from "@/components/landing/v2/search";

export const metadata = { title: "Search (v2)" };

export default async function Page() {
  return <SearchLanding signedIn={!!(await currentUser())} />;
}
