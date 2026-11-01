import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { send, type Bootstrap, type Settings } from "../lib/messages";
import { connectUrl, Logo, requestSites } from "../lib/ui";
import "../lib/page.css";

type Status = { connected: boolean; queued: number; sites: string[]; apiBase: string };

function App() {
  const [s, setS] = useState<Settings | null>(null), [status, setStatus] = useState<Status | null>(null), [boot, setBoot] = useState<Bootstrap | null>(null), [origins, setOrigins] = useState<string[]>([]);
  const refresh = async () => {
    const [settings, st, b, perms] = await Promise.all([send<Settings>({ type: "settings" }), send<Status>({ type: "status" }), send<Bootstrap | null>({ type: "bootstrap" }), chrome.permissions.getAll()]);
    setS(settings); setStatus(st); setBoot(b); setOrigins(perms.origins ?? []);
    document.documentElement.dataset.theme = settings.theme;
  };
  useEffect(() => { void refresh(); }, []);
  if (!s || !status) return null;
  const patch = async (p: Partial<Settings>) => {
    const next = await send<Settings>({ type: "updateSettings", patch: p });
    setS(next);
    document.documentElement.dataset.theme = next.theme;
  };
  const hostOf = (o: string) => o.replace(/^https?:\/\/(\*\.)?/, "").replace(/\/\*$/, "");
  const sites = [...new Set(origins.map(hostOf))].filter((h) => h !== "*");
  const curatedMissing = status.sites.filter((h) => !sites.includes(h));

  return (
    <main style={{ maxWidth: 620, margin: "0 auto", padding: "24px 16px", display: "grid", gap: 14 }}>
      <Logo />
      <h1 style={{ fontSize: 22 }}>Settings</h1>
      <section className="card">
        <h2 style={{ fontSize: 15 }}>Inline chips</h2>
        <label className="row" style={{ marginTop: 8 }}><input type="checkbox" checked={s.chipsEnabled} onChange={(e) => patch({ chipsEnabled: e.target.checked })} /> Show chips next to addresses</label>
        <label className="f">Chip style<select value={s.chipStyle} onChange={(e) => patch({ chipStyle: e.target.value as Settings["chipStyle"] })}>
          <option value="badge">Badge</option><option value="minimal">Minimal</option><option value="hidden">Hidden</option>
        </select></label>
        <label className="f">Theme<select value={s.theme} onChange={(e) => patch({ theme: e.target.value as Settings["theme"] })}>
          <option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option>
        </select></label>
      </section>
      <section className="card">
        <h2 style={{ fontSize: 15 }}>Enabled websites</h2>
        <p className="muted" style={{ margin: "4px 0 8px" }}>TagAWallet only reads pages on these sites, and only to find addresses.</p>
        {sites.length === 0 && <p className="muted">None yet.</p>}
        <ul className="plain">
          {sites.map((h) => (
            <li key={h} className="row between" style={{ padding: "4px 0", borderTop: "1px solid var(--line)" }}>
              <label className="row"><input type="checkbox" checked={!s.disabledSites.includes(h)} onChange={(e) => patch({ disabledSites: e.target.checked ? s.disabledSites.filter((x) => x !== h) : [...s.disabledSites, h] })} /> {h}</label>
              <button style={{ minHeight: 26 }} onClick={async () => { await chrome.permissions.remove({ origins: origins.filter((o) => hostOf(o) === h) }); await refresh(); }}>Remove</button>
            </li>
          ))}
        </ul>
        {curatedMissing.length > 0 && <button style={{ marginTop: 8 }} onClick={async () => { await requestSites(curatedMissing); await refresh(); }}>Enable all {status.sites.length} supported sites</button>}
      </section>
      <section className="card">
        <h2 style={{ fontSize: 15 }}>Sync</h2>
        <label className="row" style={{ marginTop: 8 }}><input type="checkbox" checked={s.cloudSync} onChange={(e) => patch({ cloudSync: e.target.checked })} /> Cloud sync</label>
        <p className="muted" style={{ margin: "4px 0 0" }}>Off means no lookups are sent, and new tags stay in this browser until you turn it back on.</p>
        {status.queued > 0 && <p className="muted">{status.queued} tag{status.queued === 1 ? "" : "s"} waiting to sync.</p>}
        <label className="f">Default private list<select value={s.defaultListId ?? ""} onChange={(e) => patch({ defaultListId: e.target.value || null })}>
          <option value="">Most recently used</option>
          {boot?.lists.filter((l) => l.visibility === "private").map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select></label>
      </section>
      <section className="card">
        <h2 style={{ fontSize: 15 }}>Keyboard shortcut</h2>
        <p className="muted" style={{ margin: "4px 0 8px" }}>Alt+Shift+T opens TagAWallet.</p>
        <button onClick={() => chrome.tabs.create({ url: "chrome://extensions/shortcuts" })}>Change shortcut</button>
      </section>
      <section className="card">
        <h2 style={{ fontSize: 15 }}>Account</h2>
        {status.connected ? (
          <>
            <p style={{ margin: "6px 0 10px" }}>{boot?.user?.displayName} <span className="muted">{boot?.user?.email}</span></p>
            <div className="row wrap">
              <button onClick={() => chrome.tabs.create({ url: `${status.apiBase}/api/account/export` })}>Export my data</button>
              <button onClick={() => chrome.tabs.create({ url: `${status.apiBase}/settings` })}>Delete account…</button>
              <button onClick={async () => { await send({ type: "signOut" }); await refresh(); }}>Sign out of this browser</button>
            </div>
          </>
        ) : <button className="primary" style={{ marginTop: 8 }} onClick={() => chrome.tabs.create({ url: connectUrl(status.apiBase) })}>Connect account</button>}
      </section>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
