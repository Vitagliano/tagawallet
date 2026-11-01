"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { api, fetcher } from "@/lib/client";
import { Button, ErrorNote, Field, Input, Logo, Modal, Textarea, VisibilityPill } from "./ui";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/search", label: "Search" },
  { href: "/entities", label: "Entities" },
  { href: "/settings", label: "Settings" },
];

export function NewListModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { mutate } = useSWR("/api/lists", fetcher);
  const [name, setName] = useState(""), [description, setDescription] = useState(""), [error, setError] = useState("");
  async function create(e: React.FormEvent) {
    e.preventDefault();
    try {
      const list = await api("/api/lists", { body: { name, description } });
      await mutate();
      setName(""); setDescription(""); onClose();
      router.push(`/lists/${list.id}`);
    } catch (err) { setError((err as Error).message); }
  }
  return (
    <Modal open={open} onClose={onClose} title="New list">
      <form onSubmit={create} className="space-y-3">
        <Field label="Name"><Input required autoFocus maxLength={80} value={name} placeholder="Research" onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Description"><Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        <p className="text-sm text-muted">New lists are private. Only you can see this until you invite someone.</p>
        <ErrorNote>{error}</ErrorNote>
        <Button type="submit" variant="primary">Create list</Button>
      </form>
    </Modal>
  );
}

export function AppShell({ children, user }: { children: React.ReactNode; user: { displayName: string; isAdmin: boolean } }) {
  const path = usePathname();
  const router = useRouter();
  const { data: lists } = useSWR<any[]>("/api/lists", fetcher);
  const [creating, setCreating] = useState(false);
  const [menu, setMenu] = useState(false);
  const active = (href: string) => path === href || path.startsWith(href + "/");
  const linkClass = (on: boolean) => `flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-sm ${on ? "bg-wash font-medium" : "text-muted hover:bg-wash hover:text-ink"}`;

  return (
    <div className="md:grid md:min-h-dvh md:grid-cols-[15rem_1fr]">
      <aside className="border-b border-line md:sticky md:top-0 md:h-dvh md:overflow-y-auto md:border-b-0 md:border-r">
        <div className="flex items-center justify-between p-4">
          <Link href="/dashboard"><Logo /></Link>
          <Button variant="ghost" className="md:hidden" aria-expanded={menu} onClick={() => setMenu(!menu)}>Menu</Button>
        </div>
        <div className={`${menu ? "block" : "hidden"} space-y-6 px-3 pb-4 md:block`}>
          <nav className="space-y-0.5">
            {NAV.map((n) => <Link key={n.href} href={n.href} onClick={() => setMenu(false)} className={linkClass(active(n.href))}>{n.label}</Link>)}
            {user.isAdmin && <Link href="/admin/reports" className={linkClass(active("/admin"))}>Moderation</Link>}
          </nav>
          <div>
            <div className="mb-1 flex items-center justify-between px-2.5">
              <h2 className="text-xs font-medium uppercase tracking-wide text-muted">Lists</h2>
              <button className="px-1 text-muted hover:text-ink" aria-label="New list" onClick={() => setCreating(true)}>+</button>
            </div>
            <ul className="space-y-0.5">
              {lists?.map((l) => (
                <li key={l.id}>
                  <Link href={`/lists/${l.id}`} onClick={() => setMenu(false)} className={linkClass(path === `/lists/${l.id}`)}>
                    <span className="truncate">{l.name}</span>
                    {l.visibility !== "private" ? <VisibilityPill visibility={l.visibility} /> : <span className="text-xs">{l.walletCount}</span>}
                  </Link>
                </li>
              ))}
              {lists?.length === 0 && <li className="px-2.5 text-sm text-muted">No lists yet</li>}
            </ul>
          </div>
          <div className="flex items-center justify-between border-t border-line px-2.5 pt-3 text-sm">
            <span className="truncate text-muted">{user.displayName}</span>
            <button className="text-muted hover:text-ink" onClick={async () => { await api("/api/auth/logout", { method: "POST" }); router.push("/login"); router.refresh(); }}>Sign out</button>
          </div>
        </div>
      </aside>
      <main className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8">{children}</main>
      <NewListModal open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}
