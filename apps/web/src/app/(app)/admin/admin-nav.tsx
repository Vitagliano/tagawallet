"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [["/admin/reports", "Moderation"], ["/admin/sites", "Extension sites"]] as const;

export function AdminNav() {
  const path = usePathname();
  return (
    <nav aria-label="Admin" className="flex gap-1 text-sm">
      {TABS.map(([href, label]) => (
        <Link key={href} href={href} aria-current={path === href ? "page" : undefined}
          className={`rounded-full px-3 py-1 ${path === href ? "bg-ink text-paper" : "bg-card text-muted hover:text-ink"}`}>{label}</Link>
      ))}
    </nav>
  );
}
