import { AppShell } from "@/components/app-shell";
import { currentUser } from "@/lib/session";

export default async function DashboardLayout ({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) return children;
  return <AppShell user={user}>{children}</AppShell>;
}
