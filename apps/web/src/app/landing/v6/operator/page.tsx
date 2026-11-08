import { currentUser } from "@/lib/session";
import { OperatorLanding } from "@/components/landing/v6/operator";

export const metadata = { title: "Operator (v6)" };

export default async function Page() {
  return <OperatorLanding signedIn={!!(await currentUser())} />;
}
