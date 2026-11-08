import { currentUser } from "@/lib/session";
import { CaseLanding } from "@/components/landing/v5/case";

export const metadata = { title: "Case File (v5)" };

export default async function Page() {
  return <CaseLanding signedIn={!!(await currentUser())} />;
}
