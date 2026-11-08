import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { send, type Bootstrap, type Settings } from "../lib/messages";
import { connectUrl, Logo, requestSite, requestSites } from "../lib/ui";
import "../lib/page.css";

type Status = { connected: boolean; queued: number; sites: string[]; apiBase: string };

function Switch({ on, label, onChange }: { on: boolean; label: string; onChange: () => void }) {
  return <button role="switch" aria-checked={on} aria-label={label} className={`switch${on ? " on" : ""}`} onClick={onChange}><span /></button>;
}

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
  const granted = [...new Set(origins.map(hostOf))].filter((h) => h !== "*");
  // Supported sites show even before access is granted, so turning one on is the same switch.
  const sites = [...new Set([...status.sites, ...granted])];
  const isOn = (h: string) => granted.includes(h) && !s.disabledSites.includes(h);
  const toggleSite = async (h: string) => {
    if (isOn(h)) { await patch({ disabledSites: [...s.disabledSites, h] }); return; }
    if (!granted.includes(h) && !(await (status.sites.includes(h) ? requestSites([h]) : requestSite(h)))) return;
    await patch({ disabledSites: s.disabledSites.filter((x) => x !== h) });
    await refresh();
  };
  const missing = status.sites.filter((h) => !granted.includes(h));
  const chips = !s.chipsEnabled ? "off" : s.chipStyle === "hidden" ? "off" : s.chipStyle;

  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: "24px 16px", display: "grid", gap: 14 }}>
      <Logo />
      <h1 style={{ fontSize: 22 }}>Settings</h1>

      <section className="card">
        <h2 className="section-title">Chips</h2>
        <p className="muted" style={{ margin: "0 0 8px" }}>The small labels shown next to addresses on websites.</p>
        <label className="f">Chip style<select value={chips} onChange={(e) => {
          const v = e.target.value;
          void patch(v === "off" ? { chipsEnabled: false } : { chipsEnabled: true, chipStyle: v as Settings["chipStyle"] });
        }}>
          <option value="badge">Badge</option><option value="minimal">Minimal</option><option value="off">Off</option>
        </select></label>
        <label className="row" style={{ marginTop: 10 }}><input type="checkbox" checked={s.showUnknown !== false} onChange={(e) => patch({ showUnknown: e.target.checked })} /> Mark addresses I haven&apos;t tagged</label>
        <label className="f">Theme<select value={s.theme} onChange={(e) => patch({ theme: e.target.value as Settings["theme"] })}>
          <option value="system">Match the page</option><option value="light">Light</option><option value="dark">Dark</option>
        </select></label>
      </section>

      <section className="card">
        <h2 className="section-title">Websites</h2>
        <p className="muted" style={{ margin: "0 0 6px" }}>TagAWallet only reads pages on sites you turn on, and only to find addresses.</p>
        <ul className="plain">
          {sites.map((h) => (
            <li key={h} className="list-row">
              <span>{h}</span>
              <Switch on={isOn(h)} label={`TagAWallet on ${h}`} onChange={() => void toggleSite(h)} />
            </li>
          ))}
        </ul>
        {missing.length > 1 && <button style={{ marginTop: 8 }} onClick={async () => { await requestSites(missing); await patch({ disabledSites: s.disabledSites.filter((h) => !missing.includes(h)) }); await refresh(); }}>Turn on all {status.sites.length} supported sites</button>}
        <p className="muted" style={{ margin: "8px 0 0" }}>Any other site can be turned on from the toolbar icon while you&apos;re on it.</p>
      </section>

      <section className="card">
        <h2 className="section-title">Saving</h2>
        <p className="muted" style={{ margin: "0 0 4px" }}>New tags are private to you. Pick a shared list in the tag form when you want your team to see one.</p>
        <label className="row" style={{ marginTop: 6 }}><input type="checkbox" checked={!s.cloudSync} onChange={(e) => patch({ cloudSync: !e.target.checked })} /> Pause syncing</label>
        <p className="muted" style={{ margin: "4px 0 0" }}>While paused, no addresses are looked up and new tags stay in this browser. They upload when you resume.</p>
        {status.queued > 0 && <p className="muted" style={{ margin: "4px 0 0" }}>{status.queued} tag{status.queued === 1 ? "" : "s"} waiting to sync.</p>}
      </section>

      <section className="card">
        <h2 className="section-title">Account</h2>
        {status.connected ? (
          <>
            <p style={{ margin: "0 0 10px" }}>{boot?.user?.displayName} <span className="muted">{boot?.user?.email}</span></p>
            <div className="row wrap">
              <button onClick={() => chrome.tabs.create({ url: `${status.apiBase}/settings` })}>Account settings</button>
              <button onClick={async () => { await send({ type: "signOut" }); await refresh(); }}>Sign out of this browser</button>
            </div>
          </>
        ) : <button className="primary" onClick={() => chrome.tabs.create({ url: connectUrl(status.apiBase) })}>Connect account</button>}
        <p className="muted" style={{ margin: "12px 0 0" }}>
          Alt+Shift+T opens TagAWallet. <a href="#" onClick={(e) => { e.preventDefault(); void chrome.tabs.create({ url: "chrome://extensions/shortcuts" }); }}>Change shortcut</a>
        </p>
      </section>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
