import { Suspense } from "react";
import { ForgotForm } from "@/components/auth-forms";

export const metadata = { title: "Reset your password" };

export default function Page() {
  return <Suspense><ForgotForm /></Suspense>;
}
