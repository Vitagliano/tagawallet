"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { api, fetcher } from "@/lib/client";
import { Button, ErrorNote, Field, Input, Modal } from "@/components/ui";

const card = "space-y-3 rounded-xl border border-line bg-card p-4";

export default function Settings() {
  const router = useRouter();
  const { data, mutate } = useSWR("/api/auth/session", fetcher);
  const user = data?.user;
  const [name, setName] = useState<string | null>(null);
  const [pw, setPw] = useState({ current: "", next: "" }), [pwMsg, setPwMsg] = useState(""), [pwErr, setPwErr] = useState("");
  const [del, setDel] = useState(false), [confirm, setConfirm] = useState(""), [password, setPassword] = useState(""), [delErr, setDelErr] = useState("");
  if (!user) return <p className="text-sm text-muted">Loading…</p>;
  const prefs = user.emailPrefs;

  return (
    <div className="max-w-2xl space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <section className={card}>
        <h2 className="font-semibold">Profile</h2>
        <Field label="Display name"><Input value={name ?? user.displayName} onChange={(e) => setName(e.target.value)} /></Field>
        <p className="text-sm text-muted">{user.email ?? "No email on this account"} · Signed in with {user.authProviders.join(", ")}</p>
        <Button disabled={!name} onClick={async () => { await api("/api/account", { method: "PATCH", body: { displayName: name } }); setName(null); mutate(); }}>Save</Button>
        <div className="flex flex-wrap gap-2 border-t border-line pt-3 text-sm">
          <a className="underline" href="/api/auth/oauth/google/start">Link Google</a>
          <a className="underline" href="/api/auth/oauth/x/start">Link X</a>
        </div>
      </section>
      <section className={card}>
        <h2 className="font-semibold">Password</h2>
        {user.hasPassword && <Field label="Current password"><Input type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></Field>}
        <Field label="New password" hint="At least 10 characters"><Input type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></Field>
        <ErrorNote>{pwErr}</ErrorNote>
        {pwMsg && <p role="status" className="text-sm text-good">{pwMsg}</p>}
        <Button disabled={!pw.next} onClick={async () => {
          setPwErr(""); setPwMsg("");
          try { await api("/api/account", { method: "PATCH", body: { password: pw } }); setPw({ current: "", next: "" }); setPwMsg("Password updated."); mutate(); }
          catch (e) { setPwErr((e as Error).message); }
        }}>Update password</Button>
      </section>
      <section className={card}>
        <h2 className="font-semibold">Email notifications</h2>
        {([["product", "Product updates"], ["moderation", "Reports about my profiles or my reports"]] as const).map(([k, label]) => (
          <label key={k} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={prefs[k]} onChange={async (e) => { await api("/api/account", { method: "PATCH", body: { emailPrefs: { ...prefs, [k]: e.target.checked } } }); mutate(); }} /> {label}
          </label>
        ))}
      </section>
      <section id="extension" className={card}>
        <h2 className="font-semibold">Browser extension</h2>
        <p className="text-sm text-muted">Install the extension, then open its popup and choose Connect. Your tags appear next to addresses on the sites you enable. Page content never leaves your browser.</p>
      </section>
      <section className={card}>
        <h2 className="font-semibold">Your data</h2>
        <p className="text-sm text-muted">Download everything in your account as JSON.</p>
        <a href="/api/account/export" className="inline-flex min-h-9 items-center rounded-md border border-line bg-card px-3 text-sm font-medium hover:bg-wash">Export my data</a>
      </section>
      <section className={`${card} border-bad/40`}>
        <h2 className="font-semibold">Delete account</h2>
        <p className="text-sm text-muted">Permanently removes your account, lists, wallets, entities and public profiles.</p>
        <Button variant="danger" onClick={() => setDel(true)}>Delete my account</Button>
      </section>
      <Modal open={del} onClose={() => setDel(false)} title="Delete your account?">
        <form className="space-y-3" onSubmit={async (e) => {
          e.preventDefault(); setDelErr("");
          try { await api("/api/account", { method: "DELETE", body: { confirm, password: password || undefined } }); router.push("/"); router.refresh(); }
          catch (err) { setDelErr((err as Error).message); }
        }}>
          <p className="text-sm text-muted">This can&apos;t be undone. Lists you shared go away for your collaborators as well.</p>
          {user.hasPassword && <Field label="Password"><Input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>}
          <Field label="Type DELETE to confirm"><Input value={confirm} onChange={(e) => setConfirm(e.target.value)} /></Field>
          <ErrorNote>{delErr}</ErrorNote>
          <Button type="submit" variant="danger" disabled={confirm !== "DELETE"}>Delete forever</Button>
        </form>
      </Modal>
    </div>
  );
}
