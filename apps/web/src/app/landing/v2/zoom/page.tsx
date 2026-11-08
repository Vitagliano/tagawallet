import { currentUser } from "@/lib/session";
import { ZoomLanding } from "@/components/landing/v2/zoom";

export const metadata = { title: "Zoom (v2)" };

export default async function Page() {
  return <ZoomLanding signedIn={!!(await currentUser())} />;
}
