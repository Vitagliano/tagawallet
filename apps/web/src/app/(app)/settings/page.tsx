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
  ["display", "Display"],
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

type WalletOpen = "peek" | "inline" | "page";

/** Tiny sketches of each way a wallet opens: a table (rows), and where the details show up. */
function OpenSketch({ kind }: { kind: WalletOpen }) {
  const rows = [0, 1, 2, 3, 4];
  return (
    <svg aria-hidden viewBox="0 0 120 72" className="h-auto w-full">
      <rect x="1" y="1" width="118" height="70" rx="7" className="fill-paper stroke-line" />
      {kind === "page" ? (
        <>
          <rect x="10" y="10" width="34" height="4" rx="2" className="fill-muted/50" />
          <rect x="10" y="20" width="100" height="44" rx="4" className="fill-card stroke-line" />
          <rect x="16" y="27" width="40" height="4" rx="2" className="fill-ink/70" />
          <rect x="16" y="35" width="40" height="12" rx="2" className="fill-wash" />
          <rect x="64" y="27" width="40" height="4" rx="2" className="fill-muted/50" />
          <rect x="64" y="35" width="40" height="5" rx="2" className="fill-wash" />
          <rect x="64" y="44" width="40" height="5" rx="2" className="fill-wash" />
        </>
      ) : kind === "inline" ? (
        <>
          {[0, 1].map((i) => <rect key={i} x="10" y={10 + i * 9} width="100" height="5" rx="2" className="fill-wash" />)}
          <rect x="10" y="28" width="100" height="5" rx="2" className="fill-accent/70" />
          <rect x="14" y="36" width="92" height="18" rx="3" className="fill-card stroke-line" />
          <rect x="18" y="40" width="34" height="3" rx="1.5" className="fill-ink/60" />
          <rect x="58" y="40" width="44" height="3" rx="1.5" className="fill-muted/50" />
          <rect x="18" y="46" width="34" height="4" rx="1.5" className="fill-wash" />
          <rect x="10" y="58" width="100" height="5" rx="2" className="fill-wash" />
        </>
      ) : (
        <>
          {rows.map((i) => <rect key={i} x="10" y={10 + i * 11} width="100" height="5" rx="2" className={i === 1 ? "fill-accent/70" : "fill-wash"} />)}
          <rect x="70" y="6" width="44" height="60" rx="5" className="fill-card stroke-ink/30" />
          <rect x="76" y="13" width="26" height="4" rx="2" className="fill-ink/70" />
          <rect x="76" y="22" width="32" height="10" rx="2" className="fill-wash" />
          <rect x="76" y="36" width="32" height="4" rx="2" className="fill-wash" />
          <rect x="76" y="44" width="32" height="4" rx="2" className="fill-wash" />
        </>
      )}
    </svg>
  );
}

const OPEN_CHOICES: { value: WalletOpen; label: string; detail: string }[] = [
  { value: "peek", label: "Peek", detail: "A panel floats over the right edge. Click other rows to swap; the list stays put." },
  { value: "inline", label: "Inline", detail: "The row expands in place to show its details." },
  { value: "page", label: "Page", detail: "The wallet takes the table's place, with a link back." },
];

/** Picks how a wallet opens from the wallet table. Saved to the account, so it follows you to other devices. */
function WalletOpenPicker({ value, onChange }: { value: WalletOpen; onChange: (v: WalletOpen) => void }) {
  return (
    <div role="radiogroup" aria-label="Open wallets as" className="grid gap-3 sm:grid-cols-3">
      {OPEN_CHOICES.map((c) => {
        const on = value === c.value;
        return (
          <button key={c.value} type="button" role="radio" aria-checked={on} onClick={() => onChange(c.value)}
            className={`flex flex-col gap-2 rounded-xl p-2.5 text-left transition-[box-shadow,background-color,transform] duration-150 ease-out active:scale-[0.98] ${on ? "bg-wash shadow-[0_0_0_2px_var(--ink)]" : "shadow-[0_0_0_1px_var(--line)] hover:bg-wash/60"}`}>
            <OpenSketch kind={c.value} />
            <span className="flex items-center gap-2 px-0.5 text-sm font-medium">
              <span aria-hidden className={`grid size-4 place-items-center rounded-full border ${on ? "border-ink" : "border-line"}`}>{on && <span className="size-2 rounded-full bg-ink" />}</span>
              {c.label}
            </span>
            <span className="px-0.5 text-xs text-pretty text-muted">{c.detail}</span>
          </button>
        );
      })}
    </div>
  );
}

type Theme = "system" | "light" | "dark";
type ThemeScope = "both" | "web" | "extension";

/** The two palettes, so each card can show a tiny preview of what it picks. */
const PALETTE = {
  light: { bg: "#f6f4ee", card: "#fffefb", wash: "#efece2", ink: "#1a1a18", line: "#dfdbcf", accent: "#c8421b" },
  dark: { bg: "#141412", card: "#1c1c19", wash: "#2a2924", ink: "#efece3", line: "#33322c", accent: "#ee6a42" },
};

/** A miniature window in a theme's colours: a sidebar, a title, rows, one highlighted. System is split down the middle. */
function ThemePreview({ theme }: { theme: Theme }) {
  const id = `split-${theme}`;
  const scene = (c: (typeof PALETTE)["light"]) => (
    <>
      <rect width="120" height="64" fill={c.bg} />
      <rect x="8" y="10" width="22" height="3" rx="1.5" fill={c.ink} opacity=".55" />
      <rect x="8" y="17" width="18" height="3" rx="1.5" fill={c.wash} />
      <rect x="8" y="23" width="20" height="3" rx="1.5" fill={c.wash} />
      <rect x="36" y="8" width="76" height="48" rx="5" fill={c.card} stroke={c.line} />
      <rect x="42" y="14" width="30" height="4" rx="2" fill={c.ink} />
      <rect x="42" y="24" width="64" height="5" rx="2" fill={c.accent} opacity=".85" />
      <rect x="42" y="33" width="64" height="5" rx="2" fill={c.wash} />
      <rect x="42" y="42" width="64" height="5" rx="2" fill={c.wash} />
    </>
  );
  return (
    <svg aria-hidden viewBox="0 0 120 64" className="h-auto w-full rounded-lg">
      {theme === "system" ? (
        <>
          <defs><clipPath id={id}><path d="M60 0H120V64H60z" /></clipPath></defs>
          {scene(PALETTE.light)}
          <g clipPath={`url(#${id})`}>{scene(PALETTE.dark)}</g>
          <path d="M60 0V64" stroke={PALETTE.dark.line} />
        </>
      ) : scene(PALETTE[theme])}
    </svg>
  );
}

const THEMES: { value: Theme; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

/**
 * One setting: which theme, and where it's used. The places are two checkboxes (website, extension); at least one
 * stays on, so the theme always applies somewhere. Stored as a single scope: both, web or extension.
 */
function ThemeSetting({ theme, scope, onTheme, onScope }: { theme: Theme; scope: ThemeScope; onTheme: (t: Theme) => void; onScope: (s: ThemeScope) => void }) {
  const web = scope !== "extension", ext = scope !== "web";
  const toggle = (which: "web" | "ext") => {
    const nextWeb = which === "web" ? !web : web, nextExt = which === "ext" ? !ext : ext;
    if (!nextWeb && !nextExt) return;
    onScope(nextWeb && nextExt ? "both" : nextWeb ? "web" : "extension");
  };
  const place = (key: "web" | "ext", label: string, on: boolean, icon: ReactNode) => {
    const last = on && (key === "web" ? !ext : !web);
    return (
      <label className={`relative inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg pr-3 pl-2.5 text-sm transition-[background-color,box-shadow] duration-150 ${on ? "bg-wash shadow-[0_0_0_1px_var(--line)]" : "hover:bg-wash/60"} ${last ? "cursor-default" : ""}`}
        title={last ? "The theme needs to apply somewhere" : undefined}>
        {/* The real checkbox covers the whole pill (transparent), so the full pill is the target and it stays reachable. */}
        <input type="checkbox" checked={on} disabled={last} onChange={() => toggle(key)} className="peer absolute inset-0 cursor-pointer appearance-none rounded-lg opacity-0 disabled:cursor-default" />
        <span aria-hidden className={`grid size-4 place-items-center rounded border transition-colors duration-150 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent ${on ? "border-ink bg-ink text-paper" : "border-line bg-card"}`}>
          {on && <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round"><path d="m3.5 8.5 3 3 6-7" /></svg>}
        </span>
        <span className="text-muted">{icon}</span>{label}
      </label>
    );
  };
  const outline = (d: ReactNode) => <svg aria-hidden viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">{d}</svg>;
  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">Theme</p>
        <p className="text-sm text-muted">Light or dark, or follow your system.</p>
      </div>
      <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-3">
        {THEMES.map((t) => {
          const on = theme === t.value;
          return (
            <button key={t.value} type="button" role="radio" aria-checked={on} aria-label={t.label} onClick={() => onTheme(t.value)}
              className={`flex flex-col gap-2 rounded-xl p-2 text-left transition-[box-shadow,background-color,transform] duration-150 ease-out active:scale-[0.98] ${on ? "bg-wash shadow-[0_0_0_2px_var(--ink)]" : "shadow-[0_0_0_1px_var(--line)] hover:bg-wash/60"}`}>
              <ThemePreview theme={t.value} />
              <span className="flex items-center gap-2 px-0.5 pb-0.5 text-sm font-medium">
                <span aria-hidden className={`grid size-4 place-items-center rounded-full border ${on ? "border-ink" : "border-line"}`}>{on && <span className="size-2 rounded-full bg-ink" />}</span>
                {t.label}
              </span>
            </button>
          );
        })}
      </div>
      <div role="group" aria-label="Use the theme on" className="flex flex-wrap items-center gap-x-2 gap-y-2 pt-1">
        <span className="mr-1 text-sm text-muted">Use it on</span>
        {place("web", "Website", web, outline(<><circle cx="8" cy="8" r="5.5" /><path d="M2.5 8h11M8 2.5c1.6 1.6 2.4 3.4 2.4 5.5S9.6 11.9 8 13.5M8 2.5C6.4 4.1 5.6 5.9 5.6 8s.8 3.9 2.4 5.5" /></>))}
        {place("ext", "Extension", ext, outline(<path d="M6.5 2.5h2a1 1 0 0 1 1 1v1a1.25 1.25 0 0 0 2.5 0 1 1 0 0 1 1-1v0a1 1 0 0 1 1 1v2.5a1 1 0 0 1-1 1h-.5a1.25 1.25 0 0 0 0 2.5h.5a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z" />))}
      </div>
      <p className="text-xs text-pretty text-muted">
        {scope === "web" ? "The extension follows your system." : scope === "extension" ? "The website follows your system. The extension picks it up the next time it syncs." : "The extension picks it up the next time it syncs."}
      </p>
    </div>
  );
}

/** What <html data-theme> should be on the website for this choice ("system" means: don't force one). */
const webTheme = (theme: Theme, scope: ThemeScope): Theme => (scope === "extension" ? "system" : theme);
function applyWebTheme(theme: Theme, scope: ThemeScope) {
  const t = webTheme(theme, scope);
  if (t === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
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
  const { data: myLists } = useSWR<any[]>("/api/lists", fetcher);
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
  const publicLists = myLists?.filter((l) => l.publishedAt && l.role === "owner") ?? [];
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

        <Section id="profile" title="Profile" description="How you appear to people you share lists with, and on anything you make public.">
          <AutoField label="Display name" value={user.displayName} onSave={async (displayName) => { if (!displayName.trim()) throw new Error("Add a name"); await api("/api/account", { method: "PATCH", body: { displayName } }); await mutate(); router.refresh(); }} />
          <Row title="Email" detail={user.email ?? "Sign in with email and a password to add one."} />
          <div className="mt-4 space-y-3 border-t border-line pt-4">
            <Row title="Public profile" detail={user.profilePublic && user.handle
              ? <>Live at <Link className="underline" href={`/u/${user.handle}`} target="_blank">tagawallet.com/u/{user.handle}</Link>. It lists the contacts and lists you made public.</>
              : "A page that lists the contacts and lists you made public. Everything else stays private."}>
              <Switch on={!!user.profilePublic} label="Public profile" onChange={async (profilePublic) => {
                try { await api("/api/account", { method: "PATCH", body: { profilePublic } }); await mutate(); toast(profilePublic ? "Your public profile is on." : "Your public profile is off."); }
                catch (e) { toast((e as Error).message); }
              }} />
            </Row>
            <AutoField label="Handle" value={user.handle ?? ""} placeholder="yourname" mono onSave={async (handle) => { await api("/api/account", { method: "PATCH", body: { handle } }); await mutate(); }} />
            <AutoField label="Bio" multiline value={user.bio ?? ""} placeholder="A line about you, shown on your public profile" onSave={async (bio) => { await api("/api/account", { method: "PATCH", body: { bio } }); await mutate(); }} />
          </div>
        </Section>

        <Section id="display" title="Display" description="How the app looks, and how a wallet opens.">
          <ThemeSetting theme={user.theme ?? "system"} scope={user.themeScope ?? "both"}
            onTheme={async (theme) => {
              applyWebTheme(theme, user.themeScope ?? "both");
              await mutate({ user: { ...user, theme } }, { revalidate: false });
              try { await api("/api/account", { method: "PATCH", body: { theme } }); toast("Saved."); }
              catch (e) { toast((e as Error).message); await mutate(); }
            }}
            onScope={async (themeScope) => {
              applyWebTheme(user.theme ?? "system", themeScope);
              await mutate({ user: { ...user, themeScope } }, { revalidate: false });
              try { await api("/api/account", { method: "PATCH", body: { themeScope } }); toast("Saved."); }
              catch (e) { toast((e as Error).message); await mutate(); }
            }} />
          {/* A different setting, so a line between them. */}
          <div className="mt-5 space-y-3 border-t border-line pt-5">
            <div>
              <p className="text-sm font-medium">Wallets open as</p>
              <p className="text-sm text-muted">What happens when you click a wallet in your list.</p>
            </div>
          <WalletOpenPicker value={user.walletOpen ?? "peek"} onChange={async (walletOpen) => {
            // Show the choice at once; the server catches up.
            await mutate({ user: { ...user, walletOpen } }, { revalidate: false });
            try { await api("/api/account", { method: "PATCH", body: { walletOpen } }); toast("Saved."); }
            catch (e) { toast((e as Error).message); await mutate(); }
          }} />
          </div>
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

        <Section id="profiles" title="What you made public" description="Contacts and lists anyone can see, shown as published by you. Everything else you have is private.">
          {published.length || publicLists.length ? (
            <div>
              {published.map((e) => (
                <Row key={e.id} title={e.name} detail={e.verification?.status === "verified" ? "Contact · Verified" : "Contact"}>
                  <Link className="text-sm underline-offset-2 hover:underline" href={`/p/${e.slug}`}>View</Link>
                  <Link className="text-sm underline-offset-2 hover:underline" href={`/entities/${e.id}#public`}>Manage</Link>
                </Row>
              ))}
              {publicLists.map((l) => (
                <Row key={l.id} title={l.name} detail={`List · ${l.walletCount} wallet${l.walletCount === 1 ? "" : "s"}`}>
                  <Link className="text-sm underline-offset-2 hover:underline" href={`/l/${l.id}`}>View</Link>
                  <Link className="text-sm underline-offset-2 hover:underline" href={`/dashboard?in=list:${l.id}`}>Manage</Link>
                </Row>
              ))}
            </div>
          ) : <p className="text-sm text-muted">Nothing public yet. Open a contact or list and choose Make public.</p>}
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
