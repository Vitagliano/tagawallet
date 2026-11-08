import { currentUser } from "@/lib/session";
import { RolodexLanding } from "@/components/landing/v5/rolodex";

export const metadata = { title: "Rolodex (v5)" };

export default async function Page() {
  return <RolodexLanding signedIn={!!(await currentUser())} />;
}
