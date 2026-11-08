import { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { normalizeAddress, truncateAddress } from "@tagawallet/shared/lite";
import { send, type Bootstrap, type Detected, type FailedTag, type PanelMessage, type ResolvedLabel, type Route, type Settings, type Status } from "../lib/messages";
import { TAG_FORM_CSS } from "../lib/tag-form";
import { TagForm, type Target } from "../lib/parts";
import { connectUrl } from "../lib/ui";
import { CollectionView, LibraryView } from "./library-view";
import { Nav } from "./nav";
import { PageView } from "./page-view";
import { WalletView } from "./wallet-view";
import { FadeText, Icon, IconButton, initials, Logo } from "./ui";
import "./panel.css";

/**
 * One panel, two homes: floating over the page (an iframe the content script places, the default)
 * or Chrome's side panel. It's the dashboard in small: this page's wallets, and your library.
 */

const FLOAT = new URLSearchParams(location.search).get("host") === "float";
const opened = performance.now();

const formStyle = document.createElement("style");
formStyle.textContent = TAG_FORM_CSS;
document.head.append(formStyle);

// ---- Talking to the floating frame's host, over the private channel it hands us. ----
let port: MessagePort | null = null;
const waiting: unknown[] = [];
addEventListener("message", (e) => {
  if (!FLOAT || e.source !== parent || (e.data as { type?: string })?.type !== "taw:port" || !e.ports[0]) return;
  port = e.ports[0];
  // The host only ever sends routes: what a card or right-click on the page asked to show.
  port.onmessage = (ev) => { const m = ev.data as { type?: string; route?: Route }; if (m?.type === "route" && m.route) deliver(m.route); };
  for (const m of waiting.splice(0)) port.postMessage(m);
});
const toHost = (m: unknown) => (port ? port.postMessage(m) : waiting.push(m));

// A route can arrive before React has mounted, so it waits here until the app picks it up.
let routeSink: ((r: Route) => void) | null = null;
let earlyRoute: Route | null = null;
function deliver(r: Route) {
  if (routeSink) routeSink(r);
  else earlyRoute = r;
}

type Tab = "page" | "library";
/** `fromPage`: opened by a card or right-click, so saving shows the wallet rather than going back. */
type FormTarget = (Target | { address: ""; existing: null }) & { fromPage?: boolean };

function readTab(): Tab | null {
  try { const v = localStorage.getItem("taw-panel-tab"); return v === "page" || v === "library" ? v : null; } catch { return null; }
}

function App() {
  const [status, setStatus] = useState<Status | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [boot, setBoot] = useState<Bootstrap | null>(null);
  const [tab, setTab] = useState<chrome.tabs.Tab | null>(null);
  const [detected, setDetected] = useState<Detected[] | null>(null);
  const [granted, setGranted] = useState(false);
  const [view, setView] = useState<Tab | null>(readTab);
  const [form, setForm] = useState<FormTarget | null>(null);
  // Wallets and contacts opened on top of the tabs. Back pops one.
  const [stack, setStack] = useState<Route[]>([]);
  const [toast, setToast] = useState("");
  const [version, setVersion] = useState(0);
  const tabRef = useRef<number | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const host = (() => { try { const u = tab?.url ? new URL(tab.url) : null; return u && /^https?:$/.test(u.protocol) ? u.hostname : null; } catch { return null; } })();

  const say = useCallback((m: string) => {
    setToast(m);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3200);
  }, []);
  const refreshStatus = useCallback(async () => setStatus(await send<Status>({ type: "status" })), []);

  /** Shows what the page asked for. A tag route opens the form with the person's current tag filled in. */
  const go = useCallback(async (r: Route) => {
    if (r.view !== "tag") { setForm(null); setStack((s) => [...s.filter((x) => JSON.stringify(x) !== JSON.stringify(r)), r]); return; }
    const normalized = normalizeAddress(r.address, r.kind);
    const res = await send<Record<string, ResolvedLabel[]>>({ type: "resolve", addresses: [{ normalized, kind: r.kind }] }).catch(() => null);
    setForm({ address: r.address, kind: r.kind, existing: res?.[normalized]?.find((l) => l.source === "private") ?? null, fromPage: true });
  }, []);
  useEffect(() => {
    routeSink = (r) => void go(r);
    if (earlyRoute) { const r = earlyRoute; earlyRoute = null; void go(r); }
    return () => { routeSink = null; };
  }, [go]);

  const scan = useCallback(async (tabId: number | undefined) => {
    if (tabId === undefined) { setDetected(null); return; }
    const res = await chrome.tabs.sendMessage(tabId, { type: "taw:scan" }).catch(() => null) as { detected?: Detected[] } | null;
    if (tabRef.current === tabId) setDetected(res?.detected ?? null);
  }, []);
  // Labels arrive in bursts as a page loads, so rescans are batched.
  const rescan = useCallback((delay = 300) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void scan(tabRef.current), delay);
  }, [scan]);

  const follow = useCallback(async (t: chrome.tabs.Tab | null) => {
    tabRef.current = t?.id;
    setTab(t);
    let origin: string | null = null;
    try { const u = t?.url ? new URL(t.url) : null; origin = u && /^https?:$/.test(u.protocol) ? `${u.protocol}//${u.hostname}/*` : null; } catch { /* not a web page */ }
    setGranted(origin ? await chrome.permissions.contains({ origins: [origin] }) : false);
    await scan(t?.id);
    // In the side panel, pick up what this tab's page asked to show while the panel was closed.
    if (!FLOAT && t?.id !== undefined) {
      const pending = await send<Route | null>({ type: "takeRoute", tabId: t.id }).catch(() => null);
      if (pending) deliver(pending);
    }
  }, [scan]);

  useEffect(() => {
    void (async () => {
      const [st, s] = await Promise.all([send<Status>({ type: "status" }), send<Settings>({ type: "settings" })]);
      setStatus(st); setSettings(s);
      // Floating, the panel belongs to the page it's drawn on. In the side panel, it follows the tab in front.
      const own = FLOAT ? await chrome.tabs.getCurrent().catch(() => undefined) : undefined;
      const [active] = own ? [own] : await chrome.tabs.query({ active: true, currentWindow: true });
      await follow(active ?? null);
      void send({ type: "track", name: FLOAT ? "float_panel_open" : "side_panel_open" });
      void send({ type: "track", name: "panel_load_time", value: Math.round(performance.now() - opened) });
      setBoot(await send<Bootstrap | null>({ type: "bootstrap" }));
    })();
    const onActivated = async ({ tabId }: { tabId: number }) => { if (!FLOAT) await follow(await chrome.tabs.get(tabId).catch(() => null)); };
    const onUpdated = (tabId: number, info: chrome.tabs.OnUpdatedInfo, t: chrome.tabs.Tab) => {
      if (tabId !== tabRef.current) return;
      if (info.url) setTab(t);
      if (info.status === "loading") setDetected([]);
      if (info.status === "complete") void follow(t);
    };
    const onMessage = (m: PanelMessage) => {
      if (m?.tabId !== tabRef.current) return;
      if (m.type === "taw:pageChanged") rescan();
      // Already open in the side panel: show it now, and clear it so it isn't shown twice.
      if (m.type === "taw:route" && !FLOAT) void send<Route | null>({ type: "takeRoute", tabId: m.tabId }).then((r) => r && deliver(r));
    };
    // Connecting, saving or syncing anywhere shows up here at once.
    const onStorage = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area !== "local") return;
      if (["token", "queue", "failed", "authExpired"].some((k) => k in changes)) void refreshStatus();
      if ("token" in changes) { setVersion((v) => v + 1); void send<Bootstrap | null>({ type: "bootstrap" }).then(setBoot); }
      if ("settings" in changes) void send<Settings>({ type: "settings" }).then(setSettings);
    };
    chrome.tabs.onActivated.addListener(onActivated);
    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.runtime.onMessage.addListener(onMessage);
    chrome.storage.onChanged.addListener(onStorage);
    return () => {
      chrome.tabs.onActivated.removeListener(onActivated);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      chrome.runtime.onMessage.removeListener(onMessage);
      chrome.storage.onChanged.removeListener(onStorage);
    };
  }, [follow, rescan, refreshStatus]);

  // Theme: the account's choice, or the system's. The floating frame's host matches it, so the corners never flash.
  useEffect(() => {
    if (!settings) return;
    // Floating with the "system" theme, it matches the page under it. Docked, it follows the OS.
    const page = FLOAT ? new URLSearchParams(location.search).get("page") : null;
    const system = page === "dark" || page === "light" ? page : matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    const theme = settings.theme === "system" ? system : settings.theme;
    const dark = theme === "dark";
    document.documentElement.dataset.theme = theme;
    toHost({ type: "theme", theme: dark ? "dark" : "light" });
  }, [settings]);

  // Escape backs out of the form first, then closes the floating panel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (form) setForm(null);
      else if (stack.length) setStack((s) => s.slice(0, -1));
      else if (FLOAT) toHost({ type: "close" });
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [form, stack.length]);

  if (!status || !settings) return null;

  const enabled = !!host && !settings.disabledSites.includes(host) && (granted || detected !== null);
  const current: Tab = view ?? (host && enabled ? "page" : "library");
  const pick = (t: Tab) => { setView(t); try { localStorage.setItem("taw-panel-tab", t); } catch { /* storage off */ } };
  const open = (path: string) => void chrome.tabs.create({ url: `${status.apiBase}${path}` });
  const connect = () => void chrome.tabs.create({ url: connectUrl(status.apiBase) });
  const known = (detected ?? []).filter((d) => d.labels.length).length;

  // Must run straight from the click, or Chrome refuses to open the side panel.
  const toSide = () => {
    if (tab?.windowId !== undefined) void chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {});
    void send({ type: "updateSettings", patch: { panelMode: "side" } });
    toHost({ type: "close" });
  };
  const toFloat = async () => {
    setSettings(await send<Settings>({ type: "updateSettings", patch: { panelMode: "float" } }));
    if (!tab?.id || !host) { say("Saved. Open a website and click the TagAWallet icon."); return; }
    const ask = () => chrome.tabs.sendMessage(tab.id!, { type: "taw:openPanel" }).then(() => true, () => false);
    let ok = await ask();
    if (!ok) {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] }).catch(() => {});
      ok = await ask();
    }
    if (ok) window.close();
    else say("Saved. Click the TagAWallet icon on the page to open it there.");
  };

  // Floating, the header is the handle: drag it to move the panel.
  const drag = (e: React.PointerEvent<HTMLElement>) => {
    if (!FLOAT || e.button !== 0 || (e.target as Element).closest("button, a, input")) return;
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    let last = { x: e.screenX, y: e.screenY };
    const move = (ev: PointerEvent) => {
      toHost({ type: "move", dx: ev.screenX - last.x, dy: ev.screenY - last.y });
      last = { x: ev.screenX, y: ev.screenY };
    };
    // Losing capture ends the drag too, so it never stays stuck to the pointer.
    const up = () => {
      el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up); el.removeEventListener("lostpointercapture", up);
      toHost({ type: "moveEnd" });
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("lostpointercapture", up);
  };

  const header = (
    <header className={`bar${FLOAT ? " drag" : ""}`} onPointerDown={drag}>
      <Logo />
      <span className="spacer" />
      <IconButton icon="plus" label="Paste address to tag" onClick={() => setForm({ address: "", existing: null })} />
      {FLOAT
        ? <IconButton icon="sidebar" label="Move to side panel" onClick={toSide} />
        : <IconButton icon="float" label="Float over the page" onClick={() => void toFloat()} />}
      <IconButton icon="settings" label="Settings" onClick={() => chrome.runtime.openOptionsPage()} />
      {FLOAT && <IconButton icon="x" label="Close" onClick={() => toHost({ type: "close" })} />}
    </header>
  );

  const changed = () => { setVersion((v) => v + 1); void refreshStatus(); rescan(400); };

  if (form) {
    const saved = (m: string) => {
      setForm(null); say(m); changed();
      // From a card on the page: show what was just saved, so the result is right there.
      if (form.fromPage && "kind" in form && form.kind) void go({ view: "wallet", address: form.address, kind: form.kind });
    };
    return (
      <div className="app">
        {header}
        <div className="body">
          <div className="crumb"><button type="button" className="btn sm ghost press" onClick={() => setForm(null)}><Icon name="chevronLeft" size={14} />Back</button></div>
          {status.connected
            ? <TagForm key={form.address || "new"} target={form} boot={boot} host={host ?? ""} path={(() => { try { return tab?.url ? new URL(tab.url).pathname : ""; } catch { return ""; } })()} onDone={saved} onCancel={() => setForm(null)} />
            : (
              <div className="connect">
                <h2>{status.authState === "expired" ? "Your session expired" : "Connect to save tags"}</h2>
                <p>{status.authState === "expired" ? "Sign in again to keep saving tags. Nothing you saved is lost." : "Tags are private to your account. Connect once and this browser stays signed in."}</p>
                <button type="button" className="btn primary press" onClick={connect}>{status.authState === "expired" ? "Reconnect" : "Connect account"}</button>
              </div>
            )}
        </div>
        {toast && <div role="status" className="toast">{toast}</div>}
      </div>
    );
  }

  // A wallet or contact opened on top of the tabs. The tabs stay mounted underneath, so Back keeps your place.
  const top = stack[stack.length - 1];
  const back = () => setStack((s) => s.slice(0, -1));
  const routed = top?.view === "wallet"
    ? <WalletView key={`${top.address}:${version}`} address={top.address} kind={top.kind} tabId={tab?.id} version={version} onBack={back} onTag={setForm} onRoute={(r) => void go(r)} open={open} say={say} onChanged={changed} />
    : top?.view === "collection"
      ? <CollectionView key={top.id} pick={{ kind: top.kind, id: top.id, name: top.name, type: top.type }} onBack={back} backLabel="Back" onTag={setForm} open={open} version={version} />
      : null;

  return (
    <Nav.Provider value={{ go: (r) => void go(r) }}>
    <div className="app">
      {header}
      {routed && <div className="body">{routed}</div>}
      <div className="seg" role="tablist" aria-label="Panel" hidden={!!routed}>
        <button type="button" role="tab" aria-selected={current === "page"} onClick={() => pick("page")}><Icon name="page" size={14} />This page{known > 0 && <span className="n">{known}</span>}</button>
        <button type="button" role="tab" aria-selected={current === "library"} onClick={() => pick("library")}><Icon name="library" size={14} />Library</button>
      </div>

      <div className="body" role="tabpanel" aria-label={current === "page" ? "This page" : "Library"} hidden={!!routed}>
        {!status.connected && (
          <div className="callout warn" style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 0, marginBottom: 8 }}>
            <p style={{ flex: 1 }}>{status.authState === "expired" ? "Your session expired. Reconnect to keep saving tags." : "Connect to save tags and see labels."}</p>
            <button type="button" className="btn sm primary press" onClick={connect}>{status.authState === "expired" ? "Reconnect" : "Connect account"}</button>
          </div>
        )}
        {status.failed.length > 0 && <NeedsAttention failed={status.failed} onChanged={() => { void refreshStatus(); rescan(400); }} onEdit={(f) => setForm({ address: f.input.address, kind: f.label.chain === "solana" ? "solana" : f.label.chain === "bitcoin" ? "bitcoin" : "evm", existing: f.label })} say={say} />}

        {current === "page"
          ? <PageView tab={tab} host={host} detected={detected} enabled={enabled} settings={settings} onSettings={setSettings} rescan={rescan} onTag={setForm} open={open} toast={say} />
          : <LibraryView connected={status.connected} onTag={setForm} open={open} connect={connect} version={version} />}
      </div>

      <footer className="foot">
        <span className="who">
          {boot?.user && <span aria-hidden className="avatar" style={{ background: "var(--accent)", color: "var(--accent-ink)" }}>{initials(boot.user.displayName)}</span>}
          <FadeText>{status.queued > 0 ? `${status.queued} change${status.queued === 1 ? "" : "s"} waiting to sync` : boot?.user?.displayName ?? (status.connected ? "Connected" : "Not connected")}</FadeText>
        </span>
        <button type="button" className="btn sm ghost press" onClick={() => open("/dashboard")}>Open dashboard<Icon name="external" size={14} /></button>
      </footer>
      {toast && <div role="status" className="toast">{toast}</div>}
    </div>
    </Nav.Provider>
  );
}

function NeedsAttention({ failed, onChanged, onEdit, say }: { failed: FailedTag[]; onChanged: () => void; onEdit: (f: FailedTag) => void; say: (m: string) => void }) {
  return (
    <section aria-labelledby="attention" className="callout bad" style={{ marginTop: 0, marginBottom: 8 }}>
      <strong id="attention">Needs attention</strong>
      <p className="muted" style={{ margin: "2px 0 6px" }}>{failed.length === 1 ? "This tag" : "These tags"} couldn&apos;t be saved.</p>
      <ul className="plain">
        {failed.map((f) => (
          <li key={f.normalized} style={{ padding: "8px 0", borderTop: "1px solid var(--line)" }}>
            <span className="fade" style={{ fontWeight: 500 }}>{f.input.displayLabel}</span>
            <span className="addr" title={f.input.address}>{truncateAddress(f.input.address)}</span>
            <p className="bad" style={{ margin: "2px 0 6px", fontSize: 12 }}>{f.error}</p>
            <div style={{ display: "flex", gap: 6 }}>
              <button type="button" className="btn sm press" onClick={async () => { const still = await send<number>({ type: "retryFailed", normalized: f.normalized }); if (!still) say("Saved."); onChanged(); }}>Retry</button>
              <button type="button" className="btn sm press" onClick={() => onEdit(f)}>Edit</button>
              <button type="button" className="btn sm ghost press" onClick={async () => { await send({ type: "discardFailed", normalized: f.normalized }); onChanged(); }}>Discard</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Floating, draw only inside a frame our content script placed (see the nonce in content/float.ts). */
function Gate() {
  const [ok, setOk] = useState<boolean | null>(FLOAT ? null : true);
  useEffect(() => {
    if (!FLOAT) return;
    const nonce = new URLSearchParams(location.search).get("n") ?? "";
    void send<boolean>({ type: "checkFloat", nonce }).then((r) => setOk(r === true), () => setOk(false));
  }, []);
  if (ok === null) return null;
  if (!ok) return <div className="empty" style={{ margin: 14 }}><p className="title">Open TagAWallet from its toolbar icon.</p></div>;
  return <App />;
}

createRoot(document.getElementById("root")!).render(<Gate />);
