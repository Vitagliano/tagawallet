"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import { api } from "@/lib/client";
import { authClient } from "@/lib/auth-client";
import { Logo } from "./ui";
import { Menu, menuItem, ToastProvider } from "./kit";
import { WalletDrawer } from "./wallet-drawer";
import { CommandPalette } from "./command-palette";
import { CreateProvider, KindIcon, useCreate } from "./collections";

/** Until the address is confirmed, a quiet reminder with a way to resend. Hidden for this tab once dismissed. */
function VerifyEmailBanner({ email }: { email: string }) {
  const [hidden, setHidden] = useState(() => { try { return sessionStorage.getItem("taw-verify-dismissed") === "1"; } catch { return false; } });
  const [sent, setSent] = useState(""), [error, setError] = useState("");
  if (hidden) return null;
  return (
    <div role="region" aria-label="Verify your email" className="mx-auto mt-3 flex max-w-5xl flex-wrap items-center gap-x-3 gap-y-1 px-4 md:px-6">
      <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-card px-4 py-2.5 text-sm">
        <span className="min-w-0 flex-1">{sent || error || <>Confirm <b>{email}</b> to keep using TagAWallet.</>}</span>
        {!sent && (
          <button className="font-medium underline-offset-2 hover:underline" onClick={async () => {
            setError("");
            try { await api("/api/account/verify-email", { method: "POST" }); setSent(`Sent. Check ${email} for the link.`); }
            catch (e) { setError((e as Error).message); }
          }}>Resend link</button>
        )}
        <button aria-label="Dismiss" className="text-muted hover:text-ink" onClick={() => { setHidden(true); try { sessionStorage.setItem("taw-verify-dismissed", "1"); } catch { /* private mode */ } }}>✕</button>
      </div>
    </div>
  );
}

export function AppShell({ children, user }: { children: React.ReactNode; user: { displayName: string; isAdmin: boolean; email?: string | null; emailVerified?: boolean; handle?: string | null; profilePublic?: boolean } }) {
  const path = usePathname();
  const router = useRouter();
  const [palette, setPalette] = useState(false);
  const active = (href: string) => path === href || path.startsWith(href + "/");
  const tab = (on: boolean) => `inline-flex h-9 items-center gap-1 rounded-xl px-3 text-sm font-medium transition ${on ? "bg-card text-ink" : "text-muted hover:bg-card/60 hover:text-ink"}`;
  const signOut = async () => { await authClient.signOut(); router.push("/login"); router.refresh(); };
  const initial = user.displayName.trim()[0]?.toUpperCase() ?? "?";

  return (
    <ToastProvider>
    <CreateProvider>
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 bg-paper">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 md:px-6">
          <Link href="/dashboard" aria-label="TagAWallet home" className="shrink-0"><Logo /></Link>

          {/* Everything lives on home (the logo). Only admins get a second destination. */}
          {user.isAdmin && (
            <nav aria-label="Main" className="flex items-center gap-1">
              <Link href="/admin/reports" aria-current={active("/admin") ? "page" : undefined} className={tab(active("/admin"))}>Moderation</Link>
            </nav>
          )}

          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => setPalette(true)} aria-label="Search"
              className="inline-flex h-9 items-center gap-6 rounded-xl bg-card px-3 text-sm text-muted hover:text-ink">
              <span className="flex items-center gap-2"><span aria-hidden>⌕</span><span className="hidden sm:inline">Search</span></span>
              <kbd className="hidden font-sans text-xs sm:inline">⌘K</kbd>
            </button>
            <NewMenu />
            <Menu label={<span aria-hidden className="grid size-8 place-items-center rounded-full bg-accent text-sm font-semibold text-accent-ink">{initial}</span>}
              buttonClass="rounded-full" ariaLabel="Account menu">
              {(close) => (
                <>
                  <div className="mb-1 border-b border-line px-2.5 pt-1.5 pb-2.5">
                    <p className="truncate font-medium">{user.displayName}</p>
                    {user.email && <p className="truncate text-xs text-muted">{user.email}</p>}
                  </div>
                  <Link href="/settings" onClick={close} className={menuItem}>Settings</Link>
                  <Link href="/settings#sign-in" onClick={close} className={menuItem}>Sign-in methods</Link>
                  {user.profilePublic && user.handle
                    ? <Link href={`/u/${user.handle}`} onClick={close} className={menuItem}>Your public profile</Link>
                    : <Link href="/settings#profile" onClick={close} className={menuItem}>Set up your public profile</Link>}
                  <Link href="/settings#profiles" onClick={close} className={menuItem}>What you made public</Link>
                  <a href="/api/account/export" onClick={close} className={menuItem}>Export my data</a>
                  <div className="my-1 border-t border-line" />
                  <button className={menuItem} onClick={() => { close(); void signOut(); }}>Sign out</button>
                </>
              )}
            </Menu>
          </div>
        </div>
      </header>
      {user.email && user.emailVerified === false && <VerifyEmailBanner email={user.email} />}
      <main className="mx-auto w-full max-w-5xl px-4 pt-4 pb-12 md:px-6">{children}</main>
      <Suspense>
        <WalletDrawer />
        <CommandPalette open={palette} onOpenChange={setPalette} />
      </Suspense>
    </div>
    </CreateProvider>
    </ToastProvider>
  );
}

/** The one place to start anything new, on every page. */
function NewMenu() {
  const { addWallet, newList } = useCreate();
  return (
    <Menu label={<><span aria-hidden className="text-base leading-none">+</span><span className="hidden sm:inline">New</span></>} ariaLabel="Create new"
      buttonClass="inline-flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-xl bg-accent px-3 text-sm font-semibold text-accent-ink hover:opacity-90">
      {(close) => (
        <>
          <button className={`${menuItem} flex items-center gap-2`} onClick={() => { close(); newList("person"); }}><KindIcon kind="person" className="text-muted" />Person</button>
          <button className={`${menuItem} flex items-center gap-2`} onClick={() => { close(); newList("project"); }}><KindIcon kind="project" className="text-muted" />Project</button>
          <button className={`${menuItem} flex items-center gap-2`} onClick={() => { close(); addWallet(); }}>
            <span aria-hidden className="grid size-4 place-items-center font-mono text-xs text-muted">0x</span>Wallet
          </button>
          <button className={`${menuItem} flex items-center gap-2`} onClick={() => { close(); newList("list"); }}><KindIcon kind="list" className="text-muted" />List</button>
        </>
      )}
    </Menu>
  );
}
