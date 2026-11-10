"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthDrawer, type AuthDrawerMode } from "./auth-drawer";
import { Logo } from "./ui";

/** Guest view: the real empty dashboard; sign-in / sign-up open in a floating drawer. */
export function LockedDashboard () {
  const [auth, setAuth] = useState<AuthDrawerMode | null>(null);

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 bg-paper">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 md:px-6">
          <Link href="/" aria-label="TagAWallet home" className="shrink-0"><Logo /></Link>
          <div className="ml-auto flex items-center gap-2">
            <span
              aria-hidden
              className="inline-flex h-9 items-center gap-6 rounded-xl bg-card px-3 text-sm text-muted opacity-50"
            >
              <span className="flex items-center gap-2"><span>⌕</span><span className="hidden sm:inline">Search</span></span>
              <kbd className="hidden font-sans text-xs sm:inline">⌘K</kbd>
            </span>
            <span
              aria-hidden
              className="inline-flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-xl bg-accent/40 px-3 text-sm font-semibold text-accent-ink opacity-50"
            >
              <span className="text-base leading-none">+</span>
              <span className="hidden sm:inline">New</span>
            </span>
            <button
              type="button"
              onClick={() => setAuth("login")}
              className="inline-flex h-9 items-center justify-center rounded-xl px-3 text-sm font-medium text-muted hover:bg-card/60 hover:text-ink"
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => setAuth("signup")}
              className="inline-flex h-9 items-center justify-center rounded-xl bg-accent px-3 text-sm font-semibold text-accent-ink hover:opacity-90"
            >
              Create account
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl space-y-4 px-4 pt-4 pb-12 md:px-6">
        <section aria-label="Getting started" className="flex flex-wrap items-start gap-x-8 gap-y-3 rounded-2xl bg-card px-4 py-3">
          <h2 className="w-full text-sm font-semibold sm:w-auto">Getting started</h2>
          <div className="flex min-w-0 flex-1 basis-56 gap-2 text-sm">
            <span aria-hidden className="text-muted">○</span>
            <span className="min-w-0">
              <span className="font-medium">Sign in or create an account</span>
              <span className="block text-xs text-muted">Unlock contacts, lists, and your wallet book.</span>
            </span>
          </div>
          <div className="flex min-w-0 flex-1 basis-56 gap-2 text-sm">
            <span aria-hidden className="text-muted">○</span>
            <span className="min-w-0">
              <span className="font-medium">Add a contact</span>
              <span className="block text-xs text-muted">Paste an address, or use + New for a person or a project.</span>
            </span>
          </div>
        </section>

        <div className="flex gap-3">
          <div className="relative min-w-0 flex-1">
            <span aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted">⌕</span>
            <input
              type="search"
              disabled
              aria-label="Search or add"
              placeholder="Search contacts, lists and wallets, or paste an address"
              className="h-11 w-full rounded-xl border border-transparent bg-card pr-3 pl-10 text-sm placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
          <button
            type="button"
            onClick={() => setAuth("signup")}
            className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-accent px-4 text-sm font-semibold text-accent-ink hover:opacity-90"
          >
            Add wallet
          </button>
        </div>

        <div className="grid gap-5 md:grid-cols-[14rem_minmax(0,1fr)]">
          <aside aria-label="Directory" className="hidden pb-4 md:sticky md:top-20 md:block md:max-h-[calc(100dvh-6rem)] md:self-start md:overflow-y-auto">
            <ul className="space-y-0.5">
              <li className="flex min-h-9 items-center gap-2.5 rounded-lg bg-card px-2.5 text-sm font-medium shadow-sm">
                <span aria-hidden className="w-4 text-center font-mono text-[10px] text-muted">0x</span>
                All wallets
                <span className="ml-auto text-xs tabular-nums text-muted">0</span>
              </li>
              <li className="flex min-h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm text-ink/85">
                <span aria-hidden className="w-4 text-center text-muted">○</span>
                Unfiled
                <span className="ml-auto text-xs tabular-nums text-muted">0</span>
              </li>
            </ul>
            <EmptyGroup title="Contacts" />
            <EmptyGroup title="Lists" />
          </aside>

          <section aria-label="Wallets" className="min-w-0 space-y-3">
            <header>
              <h1 className="text-2xl leading-[1.1] font-semibold tracking-tight">All wallets</h1>
              <p className="mt-1 min-h-5 text-sm leading-5 text-muted">Every address you&apos;ve named.</p>
            </header>

            <div className="rounded-2xl bg-card px-6 py-12 text-center">
              <p className="font-medium">No wallets yet</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-pretty text-muted">
                Name an address you want to remember. That&apos;s all a wallet is here.
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setAuth("signup")}
                  className="inline-flex h-9 items-center justify-center rounded-md bg-accent px-3 text-sm font-medium text-accent-ink hover:opacity-90"
                >
                  Create account
                </button>
                <button
                  type="button"
                  onClick={() => setAuth("login")}
                  className="inline-flex h-9 items-center justify-center rounded-md border border-line bg-card px-3 text-sm font-medium hover:bg-wash"
                >
                  Sign in
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>

      <AuthDrawer
        open={!!auth}
        mode={auth ?? "login"}
        onClose={() => setAuth(null)}
        onModeChange={setAuth}
      />
    </div>
  );
}

function EmptyGroup ({ title }: { title: string }) {
  return (
    <div>
      <div className="flex items-center justify-between pt-5 pr-2.5 pb-1 pl-2.5">
        <h2 className="text-xs font-medium text-muted">{title}</h2>
        <span aria-hidden className="grid size-7 place-items-center rounded-md text-muted opacity-40">+</span>
      </div>
      <p className="px-2.5 py-1 text-xs text-muted">None yet</p>
    </div>
  );
}
