import { currentUser } from "@/lib/session";
import { ReceiptLanding } from "@/components/landing/v5/receipt";

export const metadata = { title: "Receipt (v5)" };

export default async function Page() {
  return <ReceiptLanding signedIn={!!(await currentUser())} />;
}
