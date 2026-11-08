"use client";

import Link from "next/link";
import { use, useState } from "react";
import { api } from "@/lib/client";
import { Button, ErrorNote, Logo } from "@/components/ui";

/** One click to confirm. A button, not an automatic request, so link scanners in mail apps can't use it up. */
export default function VerifyEmail({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [state, setState] = useState<"idle" | "busy" | "done">("idle"), [error, setError] = useState("");
  return (
    <main className="mx-auto w-full max-w-md space-y-4 px-4 py-16">
      <Link href="/"><Logo /></Link>
      <h1 className="pt-6 text-2xl font-semibold tracking-tight">{state === "done" ? "Email confirmed" : "Confirm your email"}</h1>
      {state === "done" ? (
        <>
          <p role="status" className="text-sm text-muted">Thanks. You can now publish profiles and invite people by email.</p>
          <Link className="inline-flex min-h-9 items-center rounded-md bg-accent px-3 text-sm font-medium text-accent-ink" href="/dashboard">Go to your wallets</Link>
        </>
      ) : (
        <>
          <p className="text-sm text-muted">This confirms the address belongs to you. It doesn&apos;t sign you in or change anything else.</p>
          <Button variant="primary" disabled={state === "busy"} onClick={async () => {
            setState("busy"); setError("");
            try { await api("/api/auth/verify-email", { body: { token } }); setState("done"); }
            catch (e) { setError((e as Error).message); setState("idle"); }
          }}>Confirm email</Button>
          <ErrorNote>{error}</ErrorNote>
        </>
      )}
    </main>
  );
}
