import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { publicUser, SESSION_COOKIE, userFromToken } from "./auth";

export async function currentUser() {
  const store = await cookies();
  const user = await userFromToken(store.get(SESSION_COOKIE)?.value);
  return user ? publicUser(user) : null;
}

export async function requireUser(next = "/dashboard") {
  const user = await currentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}
