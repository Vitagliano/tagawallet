"use client";

import Link from "next/link";
import useSWR from "swr";
import { api, fetcher } from "@/lib/client";

export const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");

/** Getting started: add a contact, then see those names in the browser. */
function Onboarding({ state, onDismiss }: { state: { entity: boolean; extension: boolean }; onDismiss: () => void }) {
  if (state.entity && state.extension) return null;
  const steps = [
    { done: state.entity, label: "Add a contact", hint: "Paste an address above, or use + New for a person or a project." },
    { done: state.extension, label: "Connect the browser extension", hint: <>See their names next to addresses on explorers and X. <Link className="underline" href="/settings#extension">Set up</Link></> },
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

/** The getting-started card, shown until both steps are done or it is dismissed (saved to the account). */
export function GettingStarted() {
  const { data } = useSWR("/api/dashboard", fetcher);
  const { data: session, mutate } = useSWR("/api/auth/session", fetcher);
  if (!data || !session?.user || session.user.onboardingDismissed) return null;
  const dismiss = async () => {
    await mutate({ user: { ...session.user, onboardingDismissed: true } }, { revalidate: false });
    await api("/api/account", { method: "PATCH", body: { onboardingDismissed: true } });
  };
  return <Onboarding state={{ entity: data.onboarding.entity, extension: data.onboarding.extension }} onDismiss={dismiss} />;
}

/** "3 min ago" style, for activity and recency. */
export function ago(date: string | Date) {
  const s = Math.max(0, (Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)} d ago`;
  return new Date(date).toLocaleDateString();
}

