import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, publicUser, userById } from "./auth";

export async function currentUser () {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return null;
  const user = await userById(session.user.id);
  return user ? publicUser(user) : null;
}

export async function requireUser (next = "/dashboard") {
  const user = await currentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}
