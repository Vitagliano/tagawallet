"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { REPORT_REASONS } from "@tagawallet/shared";
import { api, ClientError } from "@/lib/client";
import { Button, ErrorNote, Field, Modal, Select, Textarea } from "@/components/ui";

const LABELS: Record<string, string> = {
  incorrect: "Incorrect wallet or information", impersonation: "Impersonation", doxxing: "Harassment or doxxing", spam: "Spam",
  malicious_link: "Malicious link", stolen_profile: "Stolen or copied profile", other: "Something else",
};

export function ReportButton({ entityId, slug }: { entityId: string; slug: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false), [reason, setReason] = useState("incorrect"), [details, setDetails] = useState(""), [error, setError] = useState(""), [sent, setSent] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Report or dispute</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Report this profile">
        {sent ? <p role="status" className="text-sm">Thanks. A moderator will review this.</p> : (
          <form className="space-y-3" onSubmit={async (e) => {
            e.preventDefault(); setError("");
            try { await api(`/api/entities/${entityId}/report`, { body: { reason, details } }); setSent(true); }
            catch (err) {
              if (err instanceof ClientError && err.status === 401) router.push(`/login?next=${encodeURIComponent(`/p/${slug}`)}`);
              else setError((err as Error).message);
            }
          }}>
            <Field label="Reason"><Select value={reason} onChange={(e) => setReason(e.target.value)}>{REPORT_REASONS.map((r) => <option key={r} value={r}>{LABELS[r]}</option>)}</Select></Field>
            <Field label="Details"><Textarea rows={3} value={details} onChange={(e) => setDetails(e.target.value)} /></Field>
            <ErrorNote>{error}</ErrorNote>
            <Button type="submit" variant="primary">Send report</Button>
          </form>
        )}
      </Modal>
    </>
  );
}
