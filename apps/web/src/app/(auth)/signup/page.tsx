import { Suspense } from "react";
import { SignupForm } from "@/components/auth-forms";

export const metadata = { title: "Create your account" };

export default function Page() {
  return <Suspense><SignupForm /></Suspense>;
}
