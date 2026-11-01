import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/session";

export const metadata = { robots: { index: false, follow: false } };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return <AppShell user={user}>{children}</AppShell>;
}
