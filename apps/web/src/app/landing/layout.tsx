import type { Metadata } from "next";
import "@/components/landing/landing.css";
import { VersionSwitcher } from "@/components/landing/switcher";

// Previews to compare, not the live home page.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}<VersionSwitcher /></>;
}
