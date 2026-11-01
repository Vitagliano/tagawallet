"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ClientError } from "@/lib/client";
import { AuthFrame } from "@/components/auth-forms";
import { Button, ErrorNote } from "@/components/ui";

export default function Invite({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  const [invite, setInvite] = useState<any>(null), [error, setError] = useState("");
  useEffect(() => { api(`/api/invites/${token}`).then(setInvite).catch((e) => setError(e.message)); }, [token]);
  async function accept() {
    setError("");
    try { const r = await api(`/api/invites/${token}`, { method: "POST" }); router.push(`/lists/${r.listId}`); }
    catch (e) {
      if (e instanceof ClientError && e.status === 401) router.push(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
      else setError((e as Error).message);
    }
  }
  return (
    <AuthFrame title={invite ? `Join “${invite.listName}”` : "List invitation"}>
      {invite && (
        <div className="space-y-4">
          <p className="text-sm text-muted">You&apos;ve been invited as <b className="text-ink">{invite.role}</b>. You&apos;ll see the wallets, names, tags and notes in this list.</p>
          <Button variant="primary" className="w-full" onClick={accept}>Accept invitation</Button>
        </div>
      )}
      <ErrorNote>{error}</ErrorNote>
    </AuthFrame>
  );
}
