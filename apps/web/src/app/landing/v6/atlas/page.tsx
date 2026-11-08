import { currentUser } from "@/lib/session";
import { AtlasLanding } from "@/components/landing/v6/atlas";

export const metadata = { title: "Atlas (v6)" };

export default async function Page() {
  return <AtlasLanding signedIn={!!(await currentUser())} />;
}
