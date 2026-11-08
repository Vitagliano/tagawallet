import { currentUser } from "@/lib/session";
import { TagsLanding } from "@/components/landing/v1/tags";

export const metadata = { title: "Tags (v1)" };

export default async function Page() {
  return <TagsLanding signedIn={!!(await currentUser())} />;
}
