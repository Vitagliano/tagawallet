"use client";

import Link from "next/link";
import { Suspense } from "react";
import useSWR from "swr";
import { api, fetcher } from "@/lib/client";
import { WalletsView } from "@/components/wallets-view";
import { Help } from "@/components/kit";

/** Two steps are all it takes to get value: tag one wallet, then see names in the browser. */
function Onboarding({ state, onDismiss }: { state: { wallet: boolean; extension: boolean }; onDismiss: () => void }) {
  if (state.wallet && state.extension) return null;
  const steps = [
    { done: state.wallet, label: "Tag your first wallet", hint: "Use Add wallet below, or + New at the top of any page." },
    { done: state.extension, label: "Connect the browser extension", hint: <>See your names next to addresses on explorers and X. <Link className="underline" href="/settings#extension">Set up</Link></> },
  ];
  return (
    <section aria-label="Getting started" className="flex flex-wrap items-start gap-x-8 gap-y-3 rounded-2xl bg-card px-4 py-3">
      <h2 className="w-full text-sm font-semibold sm:w-auto">Getting started</h2>
      {steps.map((s) => (
        <div key={s.label} className="flex min-w-0 flex-1 basis-56 gap-2 text-sm">
          <span aria-hidden className={s.done ? "text-good" : "text-muted"}>{s.done ? "✓" : "○"}</span>
          <span className="min-w-0">
            <span className={s.done ? "text-muted line-through" : "font-medium"}>{s.label}</span>
            {!s.done && <span className="block text-xs text-muted">{s.hint}</span>}
          </span>
        </div>
      ))}
      <button className="ml-auto text-xs text-muted hover:text-ink" aria-label="Dismiss getting started" onClick={onDismiss}>✕</button>
    </section>
  );
}

export default function WalletsHome() {
  const { data } = useSWR("/api/dashboard", fetcher);
  const { data: session, mutate } = useSWR("/api/auth/session", fetcher);
  // Dismissing is saved to the account, so it stays dismissed on every device.
  const dismiss = async () => {
    await mutate({ user: { ...session.user, onboardingDismissed: true } }, { revalidate: false });
    await api("/api/account", { method: "PATCH", body: { onboardingDismissed: true } });
  };
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Wallets</h1>
        <Help>Every address you&apos;ve named, private to you. Organize them into lists whenever it helps, or don&apos;t.</Help>
      </div>
      {data && session?.user && !session.user.onboardingDismissed && <Onboarding state={data.onboarding} onDismiss={dismiss} />}
      <Suspense><WalletsView /></Suspense>
    </div>
  );
}
