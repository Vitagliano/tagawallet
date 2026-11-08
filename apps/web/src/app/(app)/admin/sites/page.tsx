"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { api, fetcher } from "@/lib/client";
import { Button, Empty, ErrorNote, Field, Textarea } from "@/components/ui";
import { useToast } from "@/components/kit";
import { AdminNav } from "../admin-nav";

const HOST = /^[a-z0-9.-]+\.[a-z]{2,}$/;

/** The sites the extension offers to turn on. Changes reach every browser on its next refresh, with no release. */
export default function Sites() {
  const { data: session } = useSWR("/api/auth/session", fetcher);
  const { data, mutate } = useSWR<{ sites: string[]; custom: boolean; defaults: string[] }>("/api/extension/sites", fetcher);
  const { toast } = useToast();
  const [text, setText] = useState(""), [error, setError] = useState("");
  useEffect(() => { if (data) setText(data.sites.join("\n")); }, [data]);
  if (session && !session.user?.isAdmin) return <Empty title="Moderators only" />;
  if (!data) return null;

  const hosts = text.split(/[\s,]+/).map((h) => h.trim().toLowerCase()).filter(Boolean);
  const bad = hosts.filter((h) => !HOST.test(h));
  const added = hosts.filter((h) => !data.sites.includes(h)), removed = data.sites.filter((h) => !hosts.includes(h));

  return (
    <div className="space-y-5">
      <AdminNav />
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Extension sites</h1>
        <p className="text-sm text-muted">{data.custom ? "A custom list is live." : "The built-in list is live."} {data.sites.length} sites. People still choose which ones to turn on; this is only what&apos;s offered.</p>
      </header>
      <form className="space-y-3 rounded-2xl bg-card p-4" onSubmit={async (e) => {
        e.preventDefault(); setError("");
        try { await api("/api/extension/sites", { method: "PUT", body: { sites: hosts } }); await mutate(); toast("Sites updated."); }
        catch (err) { setError((err as Error).message); }
      }}>
        <Field label="Hostnames, one per line" hint="Subdomains are included, so blockscout.com covers base.blockscout.com.">
          <Textarea rows={14} className="font-mono text-xs" spellCheck={false} value={text} onChange={(e) => setText(e.target.value)} />
        </Field>
        {bad.length > 0 && <ErrorNote>{`Not a hostname: ${bad.slice(0, 5).join(", ")}`}</ErrorNote>}
        {(added.length > 0 || removed.length > 0) && (
          <p role="status" className="text-sm text-muted">
            {added.length > 0 && <>Adding <span className="text-ink">{added.join(", ")}</span>. </>}
            {removed.length > 0 && <>Removing <span className="text-ink">{removed.join(", ")}</span>.</>}
          </p>
        )}
        <ErrorNote>{error}</ErrorNote>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="primary" disabled={!hosts.length || bad.length > 0 || (!added.length && !removed.length)}>Save sites</Button>
          {data.custom && (
            <Button type="button" onClick={async () => { await api("/api/extension/sites", { method: "DELETE" }); await mutate(); toast("Back to the built-in list."); }}>Reset to built-in list</Button>
          )}
        </div>
      </form>
    </div>
  );
}
