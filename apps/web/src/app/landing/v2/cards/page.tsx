import { currentUser } from "@/lib/session";
import { CardsLanding } from "@/components/landing/v2/cards";

export const metadata = { title: "Cards (v2)" };

export default async function Page() {
  return <CardsLanding signedIn={!!(await currentUser())} />;
}
