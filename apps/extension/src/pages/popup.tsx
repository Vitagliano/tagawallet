import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { CHAIN_IDS, CHAINS, parsePastedAddress, truncateAddress } from "@tagawallet/shared/lite";
import { chainFromHost, send, type Bootstrap, type Detected, type Settings, type TagResult } from "../lib/messages";
import { connectUrl, Logo, requestSite } from "../lib/ui";
import "../lib/page.css";

const opened = performance.now();
type Status = { connected: boolean; queued: number; apiBase: string };
const openTab = (url: string) => chrome.tabs.create({ url });

function TagForm({ initial, boot, onDone }: { initial: { address: string; chain: string }; boot: Bootstrap | null; onDone: (msg: string) => void }) {
  const [address, setAddress] = useState(initial.address), [chain, setChain] = useState(initial.chain);
  const [displayLabel, setName] = useState(""), [tags, setTags] = useState(""), [notes, setNotes] = useState("");
  const [listId, setList] = useState(boot?.lastListId && boot.lists.some((l) => l.id === boot.lastListId) ? boot.lastListId : boot?.lists[0]?.id ?? "__new");
  const [newList, setNewList] = useState(""), [entityId, setEntity] = useState(""), [newEntity, setNewEntity] = useState(""), [error, setError] = useState("");
  const chosen = boot?.lists.find((l) => l.id === listId);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError("");
    const parsed = parsePastedAddress(address);
    if (!parsed || parsed.kind === "ens" || parsed.kind === "sns") { setError("Paste a wallet address."); return; }
    const family = parsed.kind;
    const resolved = CHAINS[chain as keyof typeof CHAINS]?.family === family ? chain : CHAIN_IDS.find((c) => CHAINS[c].family === family)!;
    const r = await send<TagResult>({ type: "tag", input: {
      address: parsed.raw, chain: resolved, displayLabel, notes, tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      listId: listId === "__new" ? undefined : listId, newListName: listId === "__new" ? newList || "Research" : undefined,
      entityId: entityId && entityId !== "__new" ? entityId : undefined, newEntityName: entityId === "__new" ? newEntity || undefined : undefined,
    } });
    if (r.ok) onDone(r.queued ? `Saved. Will sync to ${r.listName} when online.` : `Saved to ${r.listName}.`);
    else setError(r.error);
  }
  return (
    <form onSubmit={submit}>
      <label className="f">Address<input className="addr" autoFocus={!initial.address} value={address} onChange={(e) => setAddress(e.target.value)} spellCheck={false} /></label>
      <label className="f">Chain<select value={chain} onChange={(e) => setChain(e.target.value)}>{CHAIN_IDS.map((c) => <option key={c} value={c}>{CHAINS[c].name}</option>)}</select></label>
      <label className="f">Name<input required autoFocus={!!initial.address} value={displayLabel} onChange={(e) => setName(e.target.value)} /></label>
      <label className="f">Entity<select value={entityId} onChange={(e) => setEntity(e.target.value)}>
        <option value="">None</option><option value="__new">New entity…</option>
        {boot?.entities.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
      </select></label>
      {entityId === "__new" && <input aria-label="Entity name" placeholder="Entity name" value={newEntity} onChange={(e) => setNewEntity(e.target.value)} style={{ marginTop: 4 }} />}
      <label className="f">Tags<input placeholder="trader, watchlist" value={tags} onChange={(e) => setTags(e.target.value)} /></label>
      <label className="f">Notes<textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
      <label className="f">List<select value={listId} onChange={(e) => setList(e.target.value)}>
        {boot?.lists.map((l) => <option key={l.id} value={l.id}>{l.visibility === "shared" ? `${l.name} (shared)` : l.name}</option>)}
        <option value="__new">New list…</option>
      </select></label>
      {listId === "__new" && <input aria-label="List name" placeholder="List name" value={newList} onChange={(e) => setNewList(e.target.value)} style={{ marginTop: 4 }} />}
      <p className="muted" style={{ margin: "6px 0" }}>{chosen?.visibility === "shared" ? `Shared: members of ${chosen.name} will see this tag.` : "Private: only you will see this tag."}</p>
      {error && <p role="alert" className="bad" style={{ margin: "6px 0" }}>{error}</p>}
      <button type="submit" className="primary">Save</button>
    </form>
  );
}

function App() {
  const [status, setStatus] = useState<Status | null>(null);
  const [boot, setBoot] = useState<Bootstrap | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [tab, setTab] = useState<chrome.tabs.Tab | null>(null);
  const [detected, setDetected] = useState<Detected[]>([]);
  const [granted, setGranted] = useState(false);
  const [form, setForm] = useState<{ address: string; chain: string } | null>(null);
  const [notice, setNotice] = useState("");

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

  if (!status || !settings) return null;
  const enabled = !!host && granted && !settings.disabledSites.includes(host);
  const dashboard = () => openTab(`${status.apiBase}/dashboard`);

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
  const taggable = detected.filter((d) => d.kind !== "ens" && d.kind !== "sns" && d.kind !== "x");
  const one = detected.length === 1 ? detected[0] : null;
  const top = one?.labels[0];

  return (
    <div style={{ width: 340, padding: 12 }}>
      <div className="row between">
        <Logo />
        <button style={{ minHeight: 26, padding: "0 8px" }} aria-label="Settings" onClick={() => chrome.runtime.openOptionsPage()}>Settings</button>
      </div>

      {host && (
        <label className="row between" style={{ marginTop: 10, padding: "6px 0", borderBlock: "1px solid var(--line)" }}>
          <span className="muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{host}: {enabled ? "enabled" : "off"}</span>
          <input type="checkbox" aria-label={`Enable TagAWallet on ${host}`} checked={enabled} onChange={toggle} />
        </label>
      )}
      {!status.connected && (
        <div style={{ marginTop: 10 }}>
          <p style={{ margin: "0 0 8px" }}>Connect your account to save tags and see labels.</p>
          <button className="primary" onClick={() => openTab(connectUrl(status.apiBase))}>Connect account</button>
        </div>
      )}
      {status.queued > 0 && <p className="muted" style={{ margin: "8px 0 0" }}>{status.queued} tag{status.queued === 1 ? "" : "s"} waiting to sync.</p>}
      {notice && <p role="status" className="good" style={{ margin: "10px 0 0", fontWeight: 500 }}>{notice}</p>}

      <div style={{ marginTop: 10 }}>
        {form ? (
          <>
            <button style={{ minHeight: 26, padding: "0 8px" }} onClick={() => setForm(null)}>← Back</button>
            <TagForm initial={form} boot={boot} onDone={(m) => { setForm(null); setNotice(m); if (tab) setTimeout(() => void scan(tab), 400); }} />
          </>
        ) : one ? (
          <div>
            <div className="addr muted" title={one.raw}>{truncateAddress(one.raw)}</div>
            <h1 style={{ fontSize: 16, marginTop: 2 }}>{top?.label ?? "Unknown wallet"}</h1>
            {top ? (
              <>
                {top.tags.length > 0 && <p style={{ margin: "6px 0 0" }}>Tags: {top.tags.join(", ")}</p>}
                {top.entity && <p style={{ margin: "2px 0 0" }}>Wallets linked: {top.entity.linkedWallets}</p>}
                {top.links.length > 0 && <p style={{ margin: "2px 0 0" }}>{top.links.slice(0, 4).map((l) => l.label || l.type).join(" · ")}</p>}
                <p className="muted" style={{ margin: "4px 0 0" }}>Source: {top.provenance}</p>
              </>
            ) : <p className="muted" style={{ margin: "4px 0 0" }}>Not tagged yet.</p>}
            <div className="row" style={{ marginTop: 10 }}>
              {top && <button onClick={() => openTab(status.apiBase + (top.entity?.slug ? `/p/${top.entity.slug}` : top.walletId ? `/wallets/${top.walletId}` : top.entity ? `/entities/${top.entity.id}` : "/dashboard"))}>View profile</button>}
              {taggable.length > 0 && <button className={top ? "" : "primary"} onClick={() => setForm({ address: one.raw, chain: chainFromHost(host ?? "", one.kind) })}>{top ? "Edit tag" : "Tag this wallet"}</button>}
            </div>
          </div>
        ) : detected.length > 1 ? (
          <div>
            <h1 style={{ fontSize: 14 }}>{detected.length} addresses on this page <span className="muted">{known.length} known</span></h1>
            <ul className="plain" style={{ marginTop: 6, maxHeight: 280, overflow: "auto" }}>
              {detected.map((d) => (
                <li key={d.normalized} className="row between" style={{ padding: "5px 0", borderTop: "1px solid var(--line)" }}>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.labels[0]?.label ?? <span className="muted">Unknown</span>}</span>
                    <span className="addr muted" title={d.raw}>{truncateAddress(d.raw)}</span>
                  </span>
                  {d.kind !== "ens" && d.kind !== "sns" && d.kind !== "x" && <button style={{ minHeight: 26, padding: "0 8px", flex: "none" }} onClick={() => setForm({ address: d.raw, chain: d.chain })}>{d.labels.some((l) => l.source === "private") ? "Edit" : "Tag"}</button>}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div>
            <p style={{ margin: "0 0 10px" }}>No wallet detected on this page.</p>
            <div className="row wrap">
              <button className="primary" onClick={() => setForm({ address: "", chain: "ethereum" })}>Paste address to tag</button>
              <button onClick={dashboard}>Open dashboard</button>
            </div>
          </div>
        )}
      </div>
      {(one || detected.length > 1 || form) && !form && <p style={{ margin: "10px 0 0" }}><a href="#" onClick={(e) => { e.preventDefault(); dashboard(); }} className="muted">Open dashboard</a></p>}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
