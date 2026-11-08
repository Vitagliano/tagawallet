import { currentUser } from "@/lib/session";
import { StoryLanding } from "@/components/landing/v1/story";

export const metadata = { title: "Story (v1)" };

export default async function Page() {
  return <StoryLanding signedIn={!!(await currentUser())} />;
}
