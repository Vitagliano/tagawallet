"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { REPORT_REASONS } from "@tagawallet/shared";
import { api, ClientError } from "@/lib/client";
import { Button, ErrorNote, Field, Modal, Select, Textarea } from "@/components/ui";

const LABELS: Record<string, string> = {
  incorrect: "Incorrect wallet or information", impersonation: "Impersonation", doxxing: "Harassment or doxxing", spam: "Spam",
  malicious_link: "Malicious link", stolen_profile: "Stolen or copied profile", other: "Something else",
};

/**
 * Reports the whole profile, or with `link`, one wallet's claim on it.
 * `?report=<link id>` (or `?report=profile`) opens the matching form, so the extension can link straight here.
 */
export function ReportButton({ entityId, slug, link }: { entityId: string; slug: string; link?: { id: string; address: string } }) {
  const router = useRouter();
  const [open, setOpen] = useState(false), [reason, setReason] = useState("incorrect"), [details, setDetails] = useState(""), [error, setError] = useState(""), [sent, setSent] = useState(false);
  useEffect(() => {
    const want = new URLSearchParams(location.search).get("report");
    if (want && want === (link?.id ?? "profile")) setOpen(true);
  }, [link?.id]);
  const here = `/p/${slug}?report=${link?.id ?? "profile"}`;
  return (
    <>
      {link
        ? <button className="underline-offset-2 hover:text-ink hover:underline" aria-label={`Report wallet ${link.address}`} onClick={() => setOpen(true)}>Report</button>
        : <Button onClick={() => setOpen(true)}>Report or dispute</Button>}
      <Modal open={open} onClose={() => setOpen(false)} title={link ? "Report this wallet" : "Report this profile"}>
        {sent ? <p role="status" className="text-sm">Thanks. A moderator will review this.</p> : (
          <form className="space-y-3" onSubmit={async (e) => {
            e.preventDefault(); setError("");
            try {
              await api("/api/reports", { body: { targetType: link ? "wallet_entity_link" : "entity", targetId: link?.id ?? entityId, reason, details } });
              setSent(true);
            } catch (err) {
              if (err instanceof ClientError && err.status === 401) router.push(`/login?next=${encodeURIComponent(here)}`);
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
