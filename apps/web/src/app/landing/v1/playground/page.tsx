import { currentUser } from "@/lib/session";
import { PlaygroundLanding } from "@/components/landing/v1/playground";

export const metadata = { title: "Playground (v1)" };

export default async function Page() {
  return <PlaygroundLanding signedIn={!!(await currentUser())} />;
}
