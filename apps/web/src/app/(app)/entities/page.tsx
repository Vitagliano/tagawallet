import { redirect } from "next/navigation";

/** Contacts are the home page. */
export default function People() {
  redirect("/dashboard");
}