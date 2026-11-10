import { Gate } from "@/components/gate";
import { currentUser } from "@/lib/session";

export default async function Landing() {
  const user = await currentUser();
  return <Gate signedIn={!!user} />;
}
