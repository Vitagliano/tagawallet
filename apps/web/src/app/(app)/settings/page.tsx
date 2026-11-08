"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import useSWR from "swr";
import { truncateAddress } from "@tagawallet/shared";
import { api, fetcher } from "@/lib/client";
import { Button, ErrorNote, Field, Input, Modal, Pill } from "@/components/ui";
import { AutoField, useToast } from "@/components/kit";
import { signWithSolana, solanaProvider } from "@/lib/solana-client";

const SECTIONS = [
  ["profile", "Profile"],
  ["sign-in", "Sign-in methods"],
  ["extension", "Browser extension"],
  ["profiles", "Public profiles"],
  ["api", "API keys"],
  ["notifications", "Notifications"],
  ["data", "Your data"],
] as const;

function Section({ id, title, description, children, danger }: { id: string; title: string; description?: string; children: ReactNode; danger?: boolean }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className={`scroll-mt-24 rounded-2xl bg-card ${danger ? "ring-1 ring-bad/30" : ""}`}>
      <header className="border-b border-line px-5 py-4">
        <h2 id={`${id}-h`} className="font-semibold">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      </header>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

function Row({ title, detail, children }: { title: ReactNode; detail?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line py-3 first:border-t-0 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <div className="text-sm font-medium">{title}</div>
        {detail && <div className="text-sm text-muted">{detail}</div>}
      </div>
      {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
    </div>
  );
}

function Switch({ on, label, onChange }: { on: boolean; label: string; onChange: (v: boolean) => void }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
      className={`relative h-5 w-9 shrink-0 rounded-full transition ${on ? "bg-accent" : "bg-line"}`}>
      <span className={`absolute top-0.5 left-0.5 size-4 rounded-full bg-card shadow transition ${on ? "translate-x-4" : ""}`} />
    </button>
  );
}

/** Proves control of an address by signing a message. Never a transaction. */
async function linkWallet() {
  const eth = (window as any).ethereum;
  if (!eth) throw new Error("No browser wallet found. Install one, then try again.");
  const [address] = await eth.request({ method: "eth_requestAccounts" });
  const { message, nonce } = await api("/api/auth/wallet");
  const signature = await eth.request({ method: "personal_sign", params: [message, address] });
  await api("/api/auth/wallet", { body: { address, signature, nonce } });
}

/** Personal API keys for the read-only API. A new key is shown once, then only its prefix. */
function ApiKeys() {
  const { data: keys, mutate } = useSWR<{ id: string; name: string; prefix: string; createdAt: string; lastUsedAt: string | null }[]>("/api/account/api-keys", fetcher);
  const [name, setName] = useState(""), [fresh, setFresh] = useState(""), [error, setError] = useState("");
  return (
    <div className="space-y-3">
      {keys?.length ? (
        <div>
          {keys.map((k) => (
            <Row key={k.id} title={k.name} detail={<><code className="text-xs">{k.prefix}…</code> · created {new Date(k.createdAt).toLocaleDateString()} · {k.lastUsedAt ? `last used ${new Date(k.lastUsedAt).toLocaleDateString()}` : "never used"}</>}>
              <Button variant="ghost" aria-label={`Revoke ${k.name}`} onClick={async () => { await api(`/api/account/api-keys/${k.id}`, { method: "DELETE" }); await mutate(); }}>Revoke</Button>
            </Row>
          ))}
        </div>
      ) : keys && <p className="text-sm text-muted">No keys yet.</p>}
      {fresh && (
        <div role="status" className="space-y-1 rounded-md bg-wash p-3 text-sm">
          <p className="font-medium">Copy your key now. It won&apos;t be shown again.</p>
          <Input readOnly aria-label="New API key" className="font-mono text-xs" value={fresh} onFocus={(e) => e.target.select()} />
        </div>
      )}
      <form className="flex gap-2" onSubmit={async (e) => {
        e.preventDefault(); setError("");
        try { const r = await api("/api/account/api-keys", { body: { name } }); setFresh(r.key); setName(""); await mutate(); }
        catch (err) { setError((err as Error).message); }
      }}>
        <Input aria-label="Key name" placeholder="What it's for, e.g. research notebook" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
        <Button type="submit" disabled={!name.trim()}>Create key</Button>
      </form>
      <ErrorNote>{error}</ErrorNote>
    </div>
  );
}

/** Same shape as the page, so nothing jumps when it loads. */
function SettingsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading settings" className="mx-auto grid max-w-[50rem] gap-8 lg:grid-cols-[11rem_1fr]">
      <div className="hidden lg:block" />
      <div className="space-y-5">
        <div className="flex items-center gap-4">
          <span className="size-14 animate-pulse rounded-full bg-card" />
          <span className="h-7 w-48 animate-pulse rounded bg-card" />
        </div>
        {[0, 1, 2].map((i) => <div key={i} className="h-36 animate-pulse rounded-2xl bg-card" />)}
      </div>
    </div>
  );
}

async function linkSolanaWallet() {
  const { message, nonce } = await api("/api/auth/wallet");
  const { address, signature } = await signWithSolana(message);
  await api("/api/auth/wallet", { body: { address, signature, nonce, chain: "solana" } });
}

export default function Settings() {
  return <Suspense><SettingsInner /></Suspense>;
}

function SettingsInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { toast } = useToast();
  const { data, mutate } = useSWR("/api/auth/session", fetcher);
  const { data: providers } = useSWR<{ google: boolean; x: boolean }>("/api/auth/providers", fetcher);
  const { data: dash } = useSWR("/api/dashboard", fetcher);
  const { data: entities } = useSWR<any[]>("/api/entities", fetcher);
  const { data: ext, mutate: mutateExt } = useSWR<{ browsers: { id: string; createdAt: string; expiresAt: string }[]; lastTaggedAt: string | null }>("/api/account/extension", fetcher);
  const user = data?.user;
  const [pwOpen, setPwOpen] = useState(false), [pw, setPw] = useState({ current: "", next: "" }), [pwErr, setPwErr] = useState("");
  const [del, setDel] = useState(false), [confirm, setConfirm] = useState(""), [password, setPassword] = useState(""), [delErr, setDelErr] = useState("");
  const [signInErr, setSignInErr] = useState("");

  // Coming back from linking Google or X.
  useEffect(() => {
    const linked = params.get("linked"), failed = params.get("link_error");
    const name = (p: string | null) => (p === "x" ? "X" : "Google");
    if (linked) toast(`${name(linked)} is linked. You can sign in with it now.`);
    if (failed) setSignInErr(`That ${name(failed)} account is already linked to a different TagAWallet account.`);
    if (linked || failed) router.replace(`/settings${location.hash}`, { scroll: false });
  }, [params, router, toast]);

  if (!user) return <SettingsSkeleton />;
  const prefs = user.emailPrefs;
  const has = (p: string) => user.identities.some((i: any) => i.provider === p);
  const methods = (user.hasPassword ? 1 : 0) + user.identities.length;
  const lastWay = methods <= 1;
  const unlink = async (provider: string, address?: string) => {
    setSignInErr("");
    try { await api("/api/account/identities", { method: "DELETE", body: { provider, address } }); await mutate(); toast("Unlinked."); }
    catch (e) { setSignInErr((e as Error).message); }
  };
  const wallets = user.identities.filter((i: any) => i.provider === "wallet");
  const published = entities?.filter((e) => e.visibility === "public") ?? [];
  const since = user.createdAt ? new Date(user.createdAt).toLocaleDateString(undefined, { month: "long", year: "numeric" }) : null;

  return (
    <div className="mx-auto grid max-w-[50rem] gap-8 lg:grid-cols-[11rem_1fr]">
      <nav aria-label="Settings sections" className="hidden lg:block">
        <ul className="sticky top-24 space-y-0.5 text-sm">
          {SECTIONS.map(([id, label]) => <li key={id}><a href={`#${id}`} className="block rounded-md px-2.5 py-1.5 text-muted hover:bg-wash hover:text-ink">{label}</a></li>)}
        </ul>
      </nav>

      <div className="mx-auto w-full min-w-0 max-w-2xl space-y-5 lg:mx-0">
        <header className="flex items-center gap-4">
          <span aria-hidden className="grid size-14 shrink-0 place-items-center rounded-full bg-accent text-xl font-semibold text-accent-ink">{user.displayName.trim()[0]?.toUpperCase()}</span>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight">{user.displayName}</h1>
            <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
              {user.email ?? "No email on this account"}
              <Pill>{user.plan === "free" ? "Free plan" : user.plan}</Pill>
              {since && <span>· Member since {since}</span>}
            </p>
          </div>
        </header>

        <Section id="profile" title="Profile" description="How you appear to people you share lists with.">
          <AutoField label="Display name" value={user.displayName} onSave={async (displayName) => { if (!displayName.trim()) throw new Error("Add a name"); await api("/api/account", { method: "PATCH", body: { displayName } }); await mutate(); router.refresh(); }} />
          <Row title="Email" detail={user.email ?? "Sign in with email and a password to add one."} />
        </Section>

        <Section id="sign-in" title="Sign-in methods" description="Ways you can get into this account. Keep at least one.">
          <div>
            <Row title="Password" detail={user.hasPassword ? "Set" : "Not set. Add one to sign in with your email."}>
              <Button onClick={() => { setPwOpen(true); setPwErr(""); }}>{user.hasPassword ? "Change" : "Set password"}</Button>
            </Row>
            {providers?.google && (
              <Row title="Google" detail={has("google") ? "Linked" : "Not linked"}>
                {has("google")
                  ? <Button variant="ghost" disabled={lastWay} onClick={() => unlink("google")}>Unlink</Button>
                  : <a className="inline-flex min-h-9 items-center rounded-md border border-line bg-card px-3 text-sm font-medium hover:bg-wash" href="/api/auth/oauth/google/start">Link Google</a>}
              </Row>
            )}
            {providers?.x && (
              <Row title="X" detail={has("x") ? "Linked" : "Not linked"}>
                {has("x")
                  ? <Button variant="ghost" disabled={lastWay} onClick={() => unlink("x")}>Unlink</Button>
                  : <a className="inline-flex min-h-9 items-center rounded-md border border-line bg-card px-3 text-sm font-medium hover:bg-wash" href="/api/auth/oauth/x/start">Link X</a>}
              </Row>
            )}
            {wallets.map((w: any) => (
              <Row key={w.address} title="Wallet" detail={<span className="addr" title={w.address}>{truncateAddress(w.address)}</span>}>
                <Button variant="ghost" disabled={lastWay} onClick={() => unlink("wallet", w.address)}>Unlink</Button>
              </Row>
            ))}
            <Row title={wallets.length ? "Another wallet" : "Wallet"} detail="Sign a message to prove you control it. Never a transaction.">
              <Button onClick={async () => { setSignInErr(""); try { await linkWallet(); await mutate(); toast("Wallet linked."); } catch (e) { setSignInErr((e as Error).message); } }}>Link wallet</Button>
            </Row>
            {solanaProvider() && (
              <Row title="Solana wallet" detail="Phantom or another Solana wallet. Sign a message, never a transaction.">
                <Button onClick={async () => { setSignInErr(""); try { await linkSolanaWallet(); await mutate(); toast("Solana wallet linked."); } catch (e) { setSignInErr((e as Error).message); } }}>Link Solana wallet</Button>
              </Row>
            )}
          </div>
          {lastWay && <p className="mt-3 text-xs text-muted">This is your only way in, so it can&apos;t be removed.</p>}
          <div className="mt-3"><ErrorNote>{signInErr}</ErrorNote></div>
        </Section>

        <Section id="extension" title="Browser extension" description="Your names show up next to addresses on explorers, X and trading tools. Page content never leaves your browser.">
          {(() => {
            const count = ext?.browsers.length ?? 0;
            const connected = count > 0;
            const last = ext?.lastTaggedAt ? new Date(ext.lastTaggedAt).toLocaleDateString() : null;
            return (
              <>
                <Row
                  title={connected ? `Connected in ${count} browser${count === 1 ? "" : "s"}` : dash?.onboarding.extension ? "Not connected right now" : "Not connected yet"}
                  detail={connected
                    ? `Last connected ${new Date(ext!.browsers[0]!.createdAt).toLocaleDateString()}.${last ? ` Last tag saved from the browser ${last}.` : ""}`
                    : dash?.onboarding.extension ? "Its session ended or was disconnected. Click the extension's icon and choose Reconnect." : "Install it for Chrome, Brave or Edge, then click its icon and choose Connect account."}
                >
                  <span aria-hidden className={`size-2.5 rounded-full ${connected ? "bg-good" : "bg-line"}`} />
                  {connected && (
                    <Button variant="ghost" onClick={async () => {
                      const r = await api("/api/account/extension", { method: "DELETE" });
                      await mutateExt();
                      toast(`Disconnected ${r.disconnected} browser${r.disconnected === 1 ? "" : "s"}.`);
                    }}>Disconnect all</Button>
                  )}
                </Row>
              </>
            );
          })()}
        </Section>

        <Section id="profiles" title="Public profiles" description="People and projects you've published. Everything else you have is private.">
          {published.length ? (
            <div>
              {published.map((e) => (
                <Row key={e.id} title={e.name} detail={e.verification?.status === "verified" ? "Verified" : "Self-claimed"}>
                  <Link className="text-sm underline-offset-2 hover:underline" href={`/p/${e.slug}`}>View</Link>
                  <Link className="text-sm underline-offset-2 hover:underline" href={`/entities/${e.id}#public`}>Manage</Link>
                </Row>
              ))}
            </div>
          ) : <p className="text-sm text-muted">Nothing published. Open a person or project and choose Publish.</p>}
        </Section>

        <Section id="api" title="API keys" description="Read your wallets, lists and labels from scripts. Keys can only read, never change anything.">
          <ApiKeys />
          <p className="mt-3 text-xs text-muted"><Link className="underline" href="/docs/api">How to use the API</Link></p>
        </Section>

        <Section id="notifications" title="Notifications" description={user.email ? `Sent to ${user.email}.` : "This account has no email, so these can't be delivered. Set a password with an email account to get them."}>
          {([["product", "Product updates", "New features, now and then."], ["moderation", "Reports and moderation", "When someone reports your profile, or a report you made is resolved."]] as const).map(([k, label, detail]) => (
            <Row key={k} title={label} detail={detail}>
              <Switch on={prefs[k]} label={label} onChange={async (v) => { await api("/api/account", { method: "PATCH", body: { emailPrefs: { ...prefs, [k]: v } } }); await mutate(); }} />
            </Row>
          ))}
        </Section>

        <Section id="data" title="Your data" description="It's yours. Take it with you, or remove it for good." danger>
          <Row title="Export everything" detail="Wallets, lists, people, projects and settings as one JSON file.">
            <a href="/api/account/export" className="inline-flex min-h-9 items-center rounded-md border border-line bg-card px-3 text-sm font-medium hover:bg-wash">Export my data</a>
          </Row>
          <Row title="Delete account" detail="Permanently removes your account, wallets, lists, people, projects and public profiles.">
            <Button variant="danger" onClick={() => setDel(true)}>Delete my account</Button>
          </Row>
        </Section>
      </div>

      <Modal open={pwOpen} onClose={() => setPwOpen(false)} title={user.hasPassword ? "Change password" : "Set a password"}>
        <form className="space-y-3" onSubmit={async (e) => {
          e.preventDefault(); setPwErr("");
          try { await api("/api/account", { method: "PATCH", body: { password: pw } }); setPw({ current: "", next: "" }); setPwOpen(false); await mutate(); toast("Password updated."); }
          catch (err) { setPwErr((err as Error).message); }
        }}>
          {user.hasPassword && <Field label="Current password"><Input type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></Field>}
          <Field label="New password" hint="At least 10 characters"><Input type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></Field>
          <ErrorNote>{pwErr}</ErrorNote>
          <Button type="submit" variant="primary" disabled={pw.next.length < 10}>Save password</Button>
        </form>
      </Modal>

      <Modal open={del} onClose={() => setDel(false)} title="Delete your account?">
        <form className="space-y-3" onSubmit={async (e) => {
          e.preventDefault(); setDelErr("");
          try { await api("/api/account", { method: "DELETE", body: { confirm, password: password || undefined } }); router.push("/"); router.refresh(); }
          catch (err) { setDelErr((err as Error).message); }
        }}>
          <p className="text-sm text-muted">This can&apos;t be undone. Lists you shared go away for your collaborators as well. Consider exporting your data first.</p>
          {user.hasPassword && <Field label="Password"><Input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>}
          <Field label="Type DELETE to confirm"><Input value={confirm} onChange={(e) => setConfirm(e.target.value)} /></Field>
          <ErrorNote>{delErr}</ErrorNote>
          <Button type="submit" variant="danger" disabled={confirm !== "DELETE"}>Delete forever</Button>
        </form>
      </Modal>
    </div>
  );
}
