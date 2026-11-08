import { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { parsePastedAddress, truncateAddress } from "@tagawallet/shared/lite";
import { send, type Bootstrap, type Detected, type FailedTag, type ResolvedLabel, type Settings, type Status, type UntagResult } from "../lib/messages";
import { buildTagForm, TAG_FORM_CSS } from "../lib/tag-form";
import { connectUrl, Logo, requestSite } from "../lib/ui";
import "../lib/page.css";

const opened = performance.now();
type Target = { address: string; kind: "evm" | "solana" | "bitcoin"; existing: ResolvedLabel | null };
const openTab = (url: string) => chrome.tabs.create({ url });
const taggable = (kind: string): kind is Target["kind"] => kind === "evm" || kind === "solana" || kind === "bitcoin";

const style = document.createElement("style");
style.textContent = TAG_FORM_CSS;
document.head.append(style);

/** Mounts the shared plain-DOM tag form. */
function TagForm({ target, boot, host, path, onDone, onCancel }: { target: Target | { address: ""; kind?: undefined; existing: null }; boot: Bootstrap | null; host: string; path: string; onDone: (m: string) => void; onCancel: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const form = buildTagForm({ address: target.address, kind: target.kind, existing: target.existing, boot, host, path, onDone, onCancel });
    ref.current?.replaceChildren(form);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <div ref={ref} />;
}

function Switch({ on, label, onChange }: { on: boolean; label: string; onChange: () => void }) {
  return <button role="switch" aria-checked={on} aria-label={label} className={`switch${on ? " on" : ""}`} onClick={onChange}><span /></button>;
}

function LabelSummary({ address, labels, onTag, onOpen }: { address: string; labels: ResolvedLabel[]; onTag: () => void; onOpen?: () => void }) {
  const top = labels[0];
  const mine = labels.some((l) => l.source === "private");
  return (
    <div className="card" style={{ padding: 10 }}>
      <div className="row between">
        <strong style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{top?.label ?? "Not tagged yet"}</strong>
        {top && <span className="pill" title={top.provenance}>{top.source === "verified" ? "✓ Verified" : top.source === "private" ? "Your tag" : top.source === "shared" ? "Shared" : "Self-claimed"}</span>}
      </div>
      <div className="addr muted" title={address}>{truncateAddress(address)}</div>
      {top && (top.tags.length > 0 || (top.status && top.status !== "none")) && (
        <div className="row wrap" style={{ gap: 4, marginTop: 6 }}>
          {top.status && top.status !== "none" && <span className="pill">{top.status}</span>}
          {top.tags.slice(0, 5).map((t) => <span key={t} className="pill">{t}</span>)}
        </div>
      )}
      {top?.entity && <p className="muted" style={{ margin: "6px 0 0" }}>{top.entity.name} · {top.entity.linkedWallets} wallet{top.entity.linkedWallets === 1 ? "" : "s"}</p>}
      <div className="row" style={{ marginTop: 10 }}>
        <button className={top ? "" : "primary"} style={{ flex: 1 }} onClick={onTag}>{mine ? "Edit tag" : top ? "Add my tag" : "Tag it"}</button>
        {top && onOpen && <button style={{ flex: 1 }} onClick={onOpen}>Open</button>}
      </div>
    </div>
  );
}

function App() {
  const [status, setStatus] = useState<Status | null>(null);
  const [boot, setBoot] = useState<Bootstrap | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [tab, setTab] = useState<chrome.tabs.Tab | null>(null);
  const [detected, setDetected] = useState<Detected[]>([]);
  const [granted, setGranted] = useState(false);
  const [form, setForm] = useState<Target | { address: ""; existing: null } | null>(null);
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [lookup, setLookup] = useState<{ address: string; kind: Target["kind"]; labels: ResolvedLabel[] } | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState("");
  const refreshStatus = async () => setStatus(await send<Status>({ type: "status" }));

  const url = useMemo(() => { try { return tab?.url ? new URL(tab.url) : null; } catch { return null; } }, [tab]);
  const host = url && /^https?:$/.test(url.protocol) ? url.hostname : null;

  async function scan(t: chrome.tabs.Tab) {
    if (!t.id) return;
    const res = await chrome.tabs.sendMessage(t.id, { type: "taw:scan" }).catch(() => null);
    if (res?.detected) setDetected(res.detected);
  }
  useEffect(() => {
    (async () => {
      const [[active], st, s] = await Promise.all([chrome.tabs.query({ active: true, currentWindow: true }), send<Status>({ type: "status" }), send<Settings>({ type: "settings" })]);
      setTab(active ?? null); setStatus(st); setSettings(s);
      if (s.theme !== "system") document.documentElement.dataset.theme = s.theme;
      if (active?.url && /^https?:/.test(active.url)) {
        const o = new URL(active.url);
        setGranted(await chrome.permissions.contains({ origins: [`${o.protocol}//${o.hostname}/*`] }));
      }
      if (active) await scan(active);
      void send({ type: "track", name: "popup_open" });
      void send({ type: "track", name: "popup_load_time", value: Math.round(performance.now() - opened) });
      setBoot(await send<Bootstrap | null>({ type: "bootstrap" }));
    })();
  }, []);

  // Look up a pasted address as soon as it parses.
  useEffect(() => {
    const parsed = parsePastedAddress(query);
    if (!parsed || !taggable(parsed.kind)) { setLookup(null); return; }
    const kind = parsed.kind;
    let live = true;
    void send<Record<string, ResolvedLabel[]>>({ type: "resolve", addresses: [{ normalized: parsed.normalized, kind }] }).then((r) => {
      if (live) setLookup({ address: parsed.raw, kind, labels: r?.[parsed.normalized] ?? [] });
    });
    return () => { live = false; };
  }, [query]);

  if (!status || !settings) return null;
  const enabled = !!host && granted && !settings.disabledSites.includes(host);
  const dashboard = (path = "/dashboard") => openTab(`${status.apiBase}${path}`);
  const openLabel = (top: ResolvedLabel) => dashboard(top.entity?.slug ? `/p/${top.entity.slug}` : top.walletId ? `/dashboard?w=${top.walletId}` : top.entity ? `/entities/${top.entity.id}` : "/dashboard");

  async function toggle() {
    if (!host) return;
    if (enabled) {
      setSettings(await send({ type: "updateSettings", patch: { disabledSites: [...settings!.disabledSites, host] } }));
      setDetected([]);
      return;
    }
    // Keep this first: Chrome only allows the prompt straight from the click.
    if (!granted && !(await requestSite(host))) return;
    setGranted(true);
    setSettings(await send({ type: "updateSettings", patch: { disabledSites: settings!.disabledSites.filter((h) => h !== host) } }));
    if (tab?.id && !granted) {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] }).catch(() => {});
      setTimeout(() => void scan(tab), 800);
    } else if (tab) setTimeout(() => void scan(tab), 500);
  }

  const known = detected.filter((d) => d.labels.length);
  const startTag = (address: string, kind: string, labels: ResolvedLabel[]) => {
    if (taggable(kind)) setForm({ address, kind, existing: labels.find((l) => l.source === "private") ?? null });
  };
  const done = (m: string) => {
    setForm(null); setNotice(m); setQuery("");
    void refreshStatus();
    if (tab) setTimeout(() => void scan(tab), 400);
  };
  async function remove(d: Detected) {
    const mine = d.labels.find((l) => l.source === "private");
    if (!mine) return;
    setError("");
    const r = await send<UntagResult>({ type: "untag", address: d.raw, chain: mine.chain });
    setConfirming(null);
    if (!r.ok) { setError(r.error); return; }
    done(r.queued ? "Removed. It will sync when you're back online." : "Removed.");
  }
  async function retry(f: FailedTag) {
    const stillFailing = await send<number>({ type: "retryFailed", normalized: f.normalized });
    await refreshStatus();
    setNotice(stillFailing ? "" : "Saved.");
    if (tab) setTimeout(() => void scan(tab), 400);
  }
  async function discard(f: FailedTag) {
    await send({ type: "discardFailed", normalized: f.normalized });
    await refreshStatus();
    if (tab) setTimeout(() => void scan(tab), 400);
  }
  const editFailed = (f: FailedTag) => {
    const kind = f.label.chain === "solana" ? "solana" : f.label.chain === "bitcoin" ? "bitcoin" : "evm";
    setForm({ address: f.input.address, kind, existing: f.label });
  };

  if (form) {
    return (
      <div className="popup">
        <div className="row between">
          <button className="quiet" onClick={() => setForm(null)}>← Back</button>
          <Logo />
        </div>
        <div style={{ marginTop: 8 }}>
          <TagForm target={form} boot={boot} host={host ?? ""} path={url?.pathname ?? ""} onDone={done} onCancel={() => setForm(null)} />
        </div>
      </div>
    );
  }

  return (
    <div className="popup">
      <div className="row between">
        <Logo />
        <button className="quiet" aria-label="Settings" onClick={() => chrome.runtime.openOptionsPage()}>Settings</button>
      </div>

      {!status.connected && (
        <div className="callout row between" style={{ marginTop: 10 }}>
          <span>{status.authState === "expired" ? "Your session expired. Reconnect to keep saving tags." : "Connect to save tags and see labels."}</span>
          <button className="primary" style={{ flex: "none" }} onClick={() => openTab(connectUrl(status.apiBase))}>{status.authState === "expired" ? "Reconnect" : "Connect account"}</button>
        </div>
      )}
      {notice && <p role="status" className="good" style={{ margin: "10px 0 0", fontWeight: 500 }}>{notice}</p>}
      {error && <p role="alert" className="bad" style={{ margin: "10px 0 0" }}>{error}</p>}

      {status.failed.length > 0 && (
        <section aria-labelledby="attention" style={{ marginTop: 12 }} className="callout">
          <strong id="attention">Needs attention</strong>
          <p className="muted" style={{ margin: "2px 0 6px" }}>{status.failed.length === 1 ? "This tag" : "These tags"} couldn&apos;t be saved.</p>
          <ul className="plain">
            {status.failed.map((f) => (
              <li key={f.normalized} style={{ padding: "6px 0", borderTop: "1px solid var(--line)" }}>
                <div className="row between">
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.input.displayLabel}</span>
                    <span className="addr muted" title={f.input.address}>{truncateAddress(f.input.address)}</span>
                  </span>
                </div>
                <p className="bad" style={{ margin: "2px 0 4px", fontSize: 12 }}>{f.error}</p>
                <div className="row" style={{ gap: 6 }}>
                  <button className="small" onClick={() => void retry(f)}>Retry</button>
                  <button className="small" onClick={() => editFailed(f)}>Edit</button>
                  <button className="small quiet" onClick={() => void discard(f)}>Discard</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section style={{ marginTop: 12 }}>
        <input type="search" aria-label="Look up an address" placeholder="Who is this? Paste an address" className="addr" spellCheck={false} value={query} onChange={(e) => setQuery(e.target.value)} />
        {lookup && <div style={{ marginTop: 8 }}><LabelSummary address={lookup.address} labels={lookup.labels} onTag={() => startTag(lookup.address, lookup.kind, lookup.labels)} onOpen={lookup.labels[0] ? () => openLabel(lookup.labels[0]!) : undefined} /></div>}
        {!lookup && query.trim() && <p className="muted" style={{ margin: "6px 2px 0" }}>Paste a full EVM, Solana or Bitcoin address.</p>}
        {!query && <button className="quiet" style={{ marginTop: 4 }} onClick={() => setForm({ address: "", existing: null })}>Paste address to tag</button>}
      </section>

      {host && (
        <section style={{ marginTop: 12, borderTop: "1px solid var(--line)", paddingTop: 10 }}>
          <div className="row between">
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{host}</span>
              <span className="muted">{enabled ? (detected.length ? `${detected.length} address${detected.length === 1 ? "" : "es"} on this page · ${known.length} known` : "No wallet detected on this page.") : "Off on this site"}</span>
            </span>
            <Switch on={enabled} label={`Enable TagAWallet on ${host}`} onChange={toggle} />
          </div>
          {enabled && detected.length > 0 && (
            <ul className="plain" style={{ marginTop: 6, maxHeight: 260, overflow: "auto" }}>
              {detected.map((d) => (
                <li key={d.normalized} className="row between" style={{ padding: "6px 0", borderTop: "1px solid var(--line)" }}>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.labels[0]?.label ?? <span className="muted">Unknown</span>}</span>
                    <span className="addr muted" title={d.raw}>{truncateAddress(d.raw)}</span>
                  </span>
                  {taggable(d.kind) && confirming !== d.normalized && (
                    <span className="row" style={{ gap: 4, flex: "none" }}>
                      <button className="small" onClick={() => startTag(d.raw, d.kind, d.labels)}>{d.labels.some((l) => l.source === "private") ? "Edit" : "Tag"}</button>
                      {d.labels.some((l) => l.source === "private") && <button className="small quiet" aria-label={`Remove tag ${d.labels[0]?.label ?? ""}`} onClick={() => setConfirming(d.normalized)}>Remove</button>}
                    </span>
                  )}
                  {confirming === d.normalized && (
                    <span className="row" style={{ gap: 4, flex: "none" }}>
                      <button className="small primary" onClick={() => void remove(d)}>Remove tag</button>
                      <button className="small quiet" onClick={() => setConfirming(null)}>Keep</button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {!enabled && <p className="muted" style={{ margin: "6px 0 0" }}>Turn it on to see names next to addresses here. Only addresses are looked up, never the page.</p>}
        </section>
      )}
      {!host && <p className="muted" style={{ margin: "12px 0 0" }}>Open a website to see wallets on it. Browser pages like this one can&apos;t be scanned.</p>}
      {status.queued > 0 && <p className="muted" style={{ margin: "8px 0 0" }}>{status.queued} tag{status.queued === 1 ? "" : "s"} waiting to sync.</p>}

      <div style={{ marginTop: 12, borderTop: "1px solid var(--line)", paddingTop: 8 }}>
        <button className="quiet" onClick={() => dashboard()}>Open dashboard</button>
      </div>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
