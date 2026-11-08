import { CURATED_SITES, chainFamily, normalizeAddress, provenanceText, sanitizeUrl, type ChainId, type HandleEntry, type ResolvedLabel } from "@tagawallet/shared/lite";
import { DEFAULT_SETTINGS, isUntag, type AuthState, type Bootstrap, type FailedTag, LOCAL_SETTINGS, type Collection, type Library, type Loaded, type Message, type PageSummary, type PanelMessage, type Route, type SearchResult, type WalletFiling, type QueryAddress, type QueueItem, type Settings, type Status, type TabMessage, type TagInput, type TagResult, type UntagResult } from "./lib/messages";

const API = __API_BASE__;
const CACHE_TTL = 5 * 60_000;
// Teammates edit shared lists, so those labels go stale sooner.
const SHARED_TTL = 60_000;
const FLUSH_ALARM = "tagawallet-flush";
const MENU_ID = "tagawallet-tag-selection";
const CACHE_MAX = 5000;
const SCRIPT_ID = "tagawallet-content";

/** `address` is set for an ENS name that resolved on-chain. */
type CacheEntry = { labels: ResolvedLabel[]; expires: number; address?: string };
type Local = {
  token?: string; settings?: Settings; cache?: Record<string, CacheEntry>; queue?: QueueItem[]; failed?: FailedTag[];
  localTags?: Record<string, { input: TagInput; label: ResolvedLabel }>; sites?: string[]; bootstrap?: Bootstrap;
  handleIndex?: { entries: HandleEntry[]; expires: number; etag?: string };
  /** The panel's directory, kept so it paints at once and still shows something offline. */
  library?: Library;
  /** Set when the server rejected our token, so the person is told instead of silently signed out. */
  authExpired?: boolean;
};

const get = <K extends keyof Local>(...keys: K[]) => chrome.storage.local.get(keys) as Promise<Pick<Local, K>>;
const set = (patch: Local) => chrome.storage.local.set(patch);
const getSettings = async () => ({ ...DEFAULT_SETTINGS, ...(await get("settings")).settings });

class AuthError extends Error {}
class NetworkError extends Error {}

const normalizedOf = (q: { address: string; chain: string }) => normalizeAddress(q.address, chainFamily(q.chain as ChainId));

const pageKey = (tabId: number) => `page:${tabId}`;

/**
 * The toolbar badge. "!" when the session ended. Otherwise, with the page badge on, how many addresses
 * on the current tab are tagged (red if any is flagged). Pending or failed tags show as a dot.
 */
async function updateBadge(tabId?: number) {
  const { authExpired, queue = [], failed = [], settings } = await get("authExpired", "queue", "failed", "settings");
  const pageBadge = (settings?.pageBadge ?? DEFAULT_SETTINGS.pageBadge) && !authExpired;
  const pending = queue.length + failed.length;

  // The global badge covers every tab without its own value. A tab's own value wins while it's showing a page.
  const text = authExpired ? "!" : pending ? "•" : "";
  const color = authExpired || failed.length ? "#b3261e" : "#9a6a00";
  const title = authExpired ? "TagAWallet: session expired. Click to reconnect." : failed.length ? `TagAWallet: ${failed.length} tag${failed.length === 1 ? "" : "s"} couldn't be saved` : pending ? `TagAWallet: ${pending} change${pending === 1 ? "" : "s"} waiting to sync` : "TagAWallet";
  await chrome.action.setBadgeText({ text }).catch(() => {});
  await chrome.action.setBadgeBackgroundColor({ color }).catch(() => {});
  await chrome.action.setTitle({ title }).catch(() => {});

  // One tab when a page reported, otherwise every tab, so a settings change or sign-out leaves no stale count behind.
  const ids = tabId !== undefined ? [tabId] : (await chrome.tabs.query({}).catch(() => [])).flatMap((t) => (t.id !== undefined ? [t.id] : []));
  const pages = pageBadge && ids.length ? await chrome.storage.session.get(ids.map(pageKey)) : {};
  for (const id of ids) {
    const page = pages[pageKey(id)] as PageSummary | undefined;
    const tagged = page?.tagged ?? 0;
    const tabText = tagged ? (tagged > 99 ? "99+" : String(tagged)) : text;
    const tabColor = tagged ? (page!.flagged ? "#b3261e" : "#1b7a4a") : color;
    const tabTitle = tagged ? `TagAWallet: ${tagged} tagged on this page${page!.flagged ? `, ${page!.flagged} flagged` : ""}${page!.seen > tagged ? `, ${page!.seen - tagged} not tagged` : ""}` : title;
    await chrome.action.setBadgeText({ tabId: id, text: tabText }).catch(() => {});
    await chrome.action.setBadgeBackgroundColor({ tabId: id, color: tabColor }).catch(() => {});
    await chrome.action.setTitle({ tabId: id, title: tabTitle }).catch(() => {});
  }
}

/** Per-tab counts live in session storage, since the service worker sleeps between events. */
async function storePage(tabId: number, summary: PageSummary) {
  await chrome.storage.session.set({ [pageKey(tabId)]: summary });
  await updateBadge(tabId);
  // The side panel, if open, rescans that tab. Nobody listening is fine.
  await chrome.runtime.sendMessage({ type: "taw:pageChanged", tabId } satisfies PanelMessage).catch(() => {});
}

async function authState(): Promise<AuthState> {
  const { token, authExpired } = await get("token", "authExpired");
  return token ? "connected" : authExpired ? "expired" : "signedOut";
}

async function call<T>(path: string, init?: { method?: string; body?: unknown; headers?: Record<string, string> }, tokenOverride?: string, onResponse?: (res: Response) => void): Promise<T> {
  const token = tokenOverride ?? (await get("token")).token;
  if (!token) throw new AuthError();
  let res: Response;
  try {
    res = await fetch(API + path, {
      method: init?.method ?? (init?.body ? "POST" : "GET"),
      headers: { Authorization: `Bearer ${token}`, ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers },
      body: init?.body ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new NetworkError();
  }
  if (res.status === 401) {
    await chrome.storage.local.remove(["token", "bootstrap"]);
    await set({ authExpired: true });
    await updateBadge();
    await broadcast({ type: "taw:refresh" });
    throw new AuthError();
  }
  onResponse?.(res);
  if (res.status === 304) return null as T;
  const data = await res.json().catch(() => ({}));
  if (res.status >= 500 || res.status === 429) throw new NetworkError();
  if (!res.ok) throw new Error(data.error ?? "Couldn't save that.");
  return data;
}

async function broadcast(message: TabMessage) {
  const tabs = await chrome.tabs.query({});
  await Promise.all(tabs.map((t) => (t.id ? chrome.tabs.sendMessage(t.id, message).catch(() => {}) : null)));
}

function localLabel(input: TagInput, listName: string | null, boot?: Bootstrap | null): ResolvedLabel {
  const entity = input.entityId
    ? boot?.entities.find((e) => e.id === input.entityId)
    : input.newEntityName
      ? { id: "local", name: input.newEntityName }
      : undefined;
  return {
    source: "private", provenance: `${provenanceText("private")} · not synced yet`, label: input.displayLabel, chain: input.chain,
    tags: input.tags ?? [], status: input.status, notes: input.notes, shared: false, listName: listName ?? undefined,
    links: (input.links ?? []).filter((l) => sanitizeUrl(l.url)).map((l) => ({ type: l.type, url: l.url, label: l.label })),
    entity: entity ? { id: entity.id, name: entity.name, verification: "unverified", linkedWallets: 1, relationship: input.relationship } : undefined,
  };
}

// ---- Label resolution: local tags, then cache, then the API for what's left. ----

async function resolve(addresses: QueryAddress[]) {
  const { cache = {}, localTags = {}, token } = await get("cache", "localTags", "token");
  const settings = await getSettings();
  const now = Date.now();
  const out: Record<string, ResolvedLabel[]> = {};
  const missing: QueryAddress[] = [];
  for (const a of addresses) {
    const hit = cache[a.normalized];
    if (hit && hit.expires > now) out[a.normalized] = hit.labels;
    else missing.push(a);
  }
  if (missing.length && token && settings.cloudSync) {
    const started = performance.now();
    try {
      for (let i = 0; i < missing.length; i += 200) {
        const { results } = await call<{ results: { normalized: string; labels: ResolvedLabel[]; address?: string }[] }>("/api/extension/resolve", { body: { addresses: missing.slice(i, i + 200) } });
        for (const r of results) {
          out[r.normalized] = r.labels;
          cache[r.normalized] = { labels: r.labels, expires: now + (r.labels.some((l) => l.shared) ? SHARED_TTL : CACHE_TTL), ...(r.address ? { address: r.address } : {}) };
        }
      }
      const keys = Object.keys(cache);
      if (keys.length > CACHE_MAX) for (const k of keys.slice(0, keys.length - CACHE_MAX)) delete cache[k];
      await set({ cache });
      void trackEvent("lookup_latency", Math.round(performance.now() - started));
    } catch {
      // Offline or signed out: stale labels are better than none.
      for (const a of missing) out[a.normalized] = cache[a.normalized]?.labels ?? [];
    }
  }
  for (const a of addresses) {
    const local = localTags[a.normalized];
    out[a.normalized] = [...(local ? [local.label] : []), ...(out[a.normalized] ?? [])];
  }
  return out;
}

// ---- X handles: the whole index comes down and is matched in the page, so we never learn which profiles someone views. ----

async function handleIndex(): Promise<HandleEntry[]> {
  const { handleIndex: cached, token } = await get("handleIndex", "token");
  if (!token || !(await getSettings()).cloudSync) return [];
  if (cached && cached.expires > Date.now()) return cached.entries;
  try {
    // The server answers 304 with no body when nothing changed, so the full index isn't downloaded again.
    let etag: string | undefined;
    const res = await call<{ entries: HandleEntry[] } | null>("/api/extension/handles", {
      headers: cached?.etag ? { "If-None-Match": cached.etag } : {},
    }, undefined, (r) => { etag = r.headers.get("etag") ?? undefined; });
    const entries = res?.entries ?? cached?.entries ?? [];
    await set({ handleIndex: { entries, expires: Date.now() + 60_000, etag: etag ?? cached?.etag } });
    return entries;
  } catch {
    return cached?.entries ?? [];
  }
}

// ---- Quick tagging. Saved locally first, so it works offline and syncs later. ----

async function tag(input: TagInput): Promise<TagResult> {
  const settings = await getSettings();
  const { token, queue = [], localTags = {}, bootstrap, failed = [], authExpired } = await get("token", "queue", "localTags", "bootstrap", "failed", "authExpired");
  if (!token && settings.cloudSync) return { ok: false, needsAccount: true, error: authExpired ? "Your session expired. Reconnect your account to save tags." : "Connect your account first." };
  const family = chainFamily(input.chain as ChainId);
  const normalized = normalizeAddress(input.address, family);
  // Saving again replaces an earlier attempt the server refused.
  if (failed.some((f) => f.normalized === normalized)) await set({ failed: failed.filter((f) => f.normalized !== normalized) });
  // No list means private to you. A list is only chosen to share.
  const withDefault = { ...input };
  const fallbackName = input.newListName ?? bootstrap?.lists.find((l) => l.id === withDefault.listId)?.name ?? null;

  const queueLocally = async () => {
    localTags[normalized] = { input: withDefault, label: localLabel(withDefault, fallbackName, bootstrap) };
    await set({ localTags, queue: [...queue.filter((q) => normalizedOf(q) !== normalized), withDefault] });
    await updateBadge();
    await broadcast({ type: "taw:refresh" });
  };
  if (!settings.cloudSync) {
    await queueLocally();
    return { ok: true, queued: true, listName: null, shared: false };
  }
  try {
    const r = await call<{ listName: string | null; shared: boolean }>("/api/extension/tags", { body: withDefault });
    delete localTags[normalized];
    const { cache = {} } = await get("cache");
    delete cache[normalized];
    await set({ cache, localTags });
    await updateBadge();
    await broadcast({ type: "taw:refresh" });
    void refreshBootstrap();
    return { ok: true, queued: false, listName: r.listName, shared: r.shared };
  } catch (err) {
    if (err instanceof NetworkError) {
      await queueLocally();
      return { ok: true, queued: true, listName: fallbackName, shared: false };
    }
    if (err instanceof AuthError) return { ok: false, needsAccount: true, error: "Your session expired. Reconnect your account to save tags." };
    return { ok: false, error: (err as Error).message };
  }
}

// ---- Removing a tag. Deletes the person's own record, and queues the delete when offline. The delete is idempotent, so it's always sent. ----

async function untag(address: string, chain: string): Promise<UntagResult> {
  const settings = await getSettings();
  const { token, queue = [], localTags = {}, cache = {}, failed = [], authExpired } = await get("token", "queue", "localTags", "cache", "failed", "authExpired");
  const normalized = normalizedOf({ address, chain });
  delete localTags[normalized];
  delete cache[normalized];
  const rest = queue.filter((q) => normalizedOf(q) !== normalized);
  await set({ localTags, cache, queue: rest, failed: failed.filter((f) => f.normalized !== normalized) });
  await chrome.storage.local.remove("handleIndex");
  const finish = async (queued: boolean) => {
    await updateBadge();
    await broadcast({ type: "taw:refresh" });
    return { ok: true as const, queued };
  };
  if (!settings.cloudSync) {
    await set({ queue: [...rest, { op: "untag", address, chain }] });
    return finish(true);
  }
  if (!token) return { ok: false, needsAccount: true, error: authExpired ? "Your session expired. Reconnect your account first." : "Connect your account first." };
  try {
    await call("/api/extension/tags", { method: "DELETE", body: { address, chain } });
    return finish(false);
  } catch (err) {
    if (err instanceof NetworkError) {
      await set({ queue: [...rest, { op: "untag", address, chain }] });
      return finish(true);
    }
    if (err instanceof AuthError) return { ok: false, needsAccount: true, error: "Your session expired. Reconnect your account first." };
    return { ok: false, error: (err as Error).message };
  }
}

async function flushQueue() {
  const settings = await getSettings();
  const { queue = [], token, localTags = {}, cache = {}, failed = [] } = await get("queue", "token", "localTags", "cache", "failed");
  if (!queue.length || !token || !settings.cloudSync) return;
  const remaining: QueueItem[] = [];
  for (const [i, item] of queue.entries()) {
    const normalized = normalizedOf(item);
    try {
      if (isUntag(item)) await call("/api/extension/tags", { method: "DELETE", body: { address: item.address, chain: item.chain } });
      else await call("/api/extension/tags", { body: item });
      if (!isUntag(item)) delete localTags[normalized];
      delete cache[normalized];
    } catch (err) {
      if (err instanceof NetworkError || err instanceof AuthError) { remaining.push(...queue.slice(i)); break; }
      // The server refused it, so retrying as-is can't help. Keep it where the person can fix or drop it.
      if (isUntag(item)) continue;
      const error = (err as Error).message || "Couldn't save that.";
      const previous = localTags[normalized]?.label ?? localLabel(item, null);
      const label = { ...previous, provenance: `${provenanceText("private")} · couldn't save` };
      localTags[normalized] = { input: item, label };
      failed.splice(0, failed.length, ...failed.filter((f) => f.normalized !== normalized), { normalized, input: item, error, at: Date.now(), label });
    }
  }
  await set({ queue: remaining, localTags, cache, failed });
  await updateBadge();
  if (remaining.length !== queue.length) await broadcast({ type: "taw:refresh" });
}

async function retryFailed(normalized: string) {
  const { failed = [], queue = [] } = await get("failed", "queue");
  const item = failed.find((f) => f.normalized === normalized);
  if (!item) return 0;
  await set({ failed: failed.filter((f) => f !== item), queue: [...queue.filter((q) => normalizedOf(q) !== normalized), item.input] });
  await flushQueue();
  const after = (await get("failed")).failed ?? [];
  return after.some((f) => f.normalized === normalized) ? 1 : 0;
}

async function discardFailed(normalized: string) {
  const { failed = [], localTags = {} } = await get("failed", "localTags");
  delete localTags[normalized];
  await set({ failed: failed.filter((f) => f.normalized !== normalized), localTags });
  await updateBadge();
  await broadcast({ type: "taw:refresh" });
  return true;
}

// ---- Sites: the content script runs only where the person has granted access. ----

const hostOf = (origin: string) => new URL(origin.replace("/*", "/").replace("*.", "")).hostname;

async function syncContentScripts() {
  const settings = await getSettings();
  const granted = (await chrome.permissions.getAll()).origins ?? [];
  const matches = granted.filter((o) => !/^https?:\/\/\*\//.test(o) && !settings.disabledSites.includes(hostOf(o)) && !o.startsWith(API));
  await chrome.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] }).catch(() => {});
  if (matches.length) {
    await chrome.scripting.registerContentScripts([{ id: SCRIPT_ID, js: ["content.js"], matches, runAt: "document_idle" }]);
  }
}

async function refreshSites() {
  const res = await fetch(`${API}/api/extension/sites`).catch(() => null);
  const data = res?.ok ? await res.json().catch(() => null) : null;
  const sites: string[] = data?.sites ?? (await get("sites")).sites ?? CURATED_SITES;
  await set({ sites });
  return sites;
}

// ---- Account ----

/** Refreshes the pickers. Account settings are adopted only when asked, so a slow response can't undo a change made meanwhile. */
async function refreshBootstrap(adoptSettings = false): Promise<Bootstrap | null> {
  const { token } = await get("token");
  if (!token) return null;
  try {
    const data = await call<Bootstrap & { settings: Settings }>("/api/extension/bootstrap");
    const { settings: remote, ...bootstrap } = data;
    await set({ bootstrap });
    if (adoptSettings) {
      const local = await getSettings();
      // Site toggles are per browser. The rest follows the account.
      const kept = Object.fromEntries(LOCAL_SETTINGS.map((k) => [k, local[k]]));
      await set({ settings: { ...DEFAULT_SETTINGS, ...remote, ...kept } });
    } else if (remote?.theme) {
      // The theme can be set from the website (Settings → Display), so pick it up on every refresh, not just at startup.
      const local = await getSettings();
      if (local.theme !== remote.theme) await set({ settings: { ...local, theme: remote.theme } });
    }
    return bootstrap;
  } catch {
    return (await get("bootstrap")).bootstrap ?? null;
  }
}

// ---- The panel's library: read-only views of the dashboard. ----

async function load<T>(path: string): Promise<Loaded<T>> {
  try {
    return { data: await call<T>(path) };
  } catch (err) {
    if (err instanceof AuthError) return { data: null, error: "signedOut" };
    if (err instanceof NetworkError) return { data: null, error: "offline" };
    return { data: null, error: (err as Error).message };
  }
}

async function library(cached?: boolean): Promise<Loaded<Library>> {
  const { library: last, token } = await get("library", "token");
  if (!token) return { data: null, error: "signedOut" };
  if (cached) return { data: last ?? null, cached: true };
  const fresh = await load<Library>("/api/extension/library");
  if (fresh.data) await set({ library: fresh.data });
  // Offline, the last copy is better than nothing. It says so.
  return fresh.data ? fresh : last && fresh.error === "offline" ? { data: last, cached: true, error: "offline" } : fresh;
}

// ---- Where the toolbar icon opens TagAWallet ----

/**
 * Kept in memory as well as in settings: a page's "open this" has to call sidePanel.open synchronously,
 * and reading settings first would wait long enough to lose the click's user gesture.
 */
let panelMode: Settings["panelMode"] | undefined;
void getSettings().then((s) => { panelMode ??= s.panelMode; });

/** Side mode lets Chrome open the side panel on click. Float mode handles the click to show the panel over the page. */
async function applyPanelMode(mode: Settings["panelMode"]) {
  panelMode = mode;
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: mode === "side" }).catch(() => {});
}

const ADDRESS_KINDS = new Set(["evm", "solana", "bitcoin"]);
/** A page's route is checked like any other input: known views, and only short plain strings. */
function validRoute(r: unknown): r is Route {
  const x = r as Record<string, unknown> | null;
  if (!x || typeof x !== "object") return false;
  const short = (v: unknown, max: number) => typeof v === "string" && v.length > 0 && v.length <= max;
  if (x.view === "tag" || x.view === "wallet") return short(x.address, 128) && ADDRESS_KINDS.has(x.kind as string);
  if (x.view === "collection") return (x.kind === "list" || x.kind === "entity") && short(x.id, 64) && short(x.name, 200);
  return false;
}

chrome.action.onClicked.addListener((tab) => {
  void trackEvent("panel_open");
  // Pages an extension can't draw on (browser pages, the web store) get the side panel instead.
  // This must happen before any await, while the click still counts as a user gesture.
  if (!tab.id || !/^https?:/.test(tab.url ?? "") || /^https:\/\/chrome(webstore)?\.google\.com\//.test(tab.url ?? "")) {
    if (tab.windowId !== undefined) void chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {});
    return;
  }
  const tabId = tab.id;
  void (async () => {
    // The click grants activeTab, so the script can go in even on a site that isn't turned on.
    const shown = await chrome.tabs.sendMessage(tabId, { type: "taw:togglePanel" } satisfies TabMessage).then(() => true, () => false);
    if (shown) return;
    await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] }).catch(() => {});
    await chrome.tabs.sendMessage(tabId, { type: "taw:togglePanel" } satisfies TabMessage).catch(() => {});
  })();
});

async function trackEvent(name: string, value?: number) {
  const { token } = await get("token");
  if (!token || !(await getSettings()).cloudSync) return;
  await call("/api/events", { body: { name, value } }).catch(() => {});
}

// ---- Wiring ----

async function handle(message: Message): Promise<unknown> {
  switch (message.type) {
    case "resolve": void flushQueue(); return resolve(message.addresses);
    case "handles": return handleIndex();
    case "names": {
      const { cache = {} } = await get("cache");
      return Object.fromEntries(message.names.flatMap((n) => (cache[n]?.address ? [[n, cache[n]!.address!]] : [])));
    }
    case "tag": await chrome.storage.local.remove("handleIndex"); return tag(message.input);
    case "untag": return untag(message.address, message.chain);
    case "retryFailed": return retryFailed(message.normalized);
    case "discardFailed": return discardFailed(message.normalized);
    case "bootstrap": return (await refreshBootstrap()) ?? (await get("bootstrap")).bootstrap ?? null;
    case "settings": return getSettings();
    case "updateSettings": {
      const next = { ...(await getSettings()), ...message.patch };
      await set({ settings: next });
      await syncContentScripts();
      await broadcast({ type: "taw:settings" });
      await updateBadge();
      if (message.patch.panelMode) await applyPanelMode(next.panelMode);
      const synced = Object.fromEntries(Object.entries(message.patch).filter(([k]) => !(LOCAL_SETTINGS as readonly string[]).includes(k)));
      if (Object.keys(synced).length && next.cloudSync) await call("/api/extension/settings", { method: "PATCH", body: synced }).catch(() => {});
      if (message.patch.cloudSync) void flushQueue();
      return next;
    }
    case "setSiteEnabled": {
      const s = await getSettings();
      const disabledSites = message.enabled ? s.disabledSites.filter((h) => h !== message.host) : [...new Set([...s.disabledSites, message.host])];
      await set({ settings: { ...s, disabledSites } });
      await syncContentScripts();
      await broadcast({ type: "taw:settings" });
      return { disabledSites };
    }
    case "contentState": {
      const s = await getSettings();
      return { settings: s, active: !s.disabledSites.includes(message.host) };
    }
    case "status": {
      const { token, queue = [], sites, failed = [] } = await get("token", "queue", "sites", "failed");
      return { connected: !!token, authState: await authState(), queued: queue.length, failed, sites: sites ?? CURATED_SITES, apiBase: API } satisfies Status;
    }
    case "sites": return refreshSites();
    case "flush": await flushQueue(); return (await get("queue")).queue?.length ?? 0;
    case "signOut": {
      const { token } = await get("token");
      if (token) await fetch(`${API}/api/auth/logout`, { method: "POST", headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
      await chrome.storage.local.remove(["token", "bootstrap", "cache", "handleIndex", "authExpired", "library"]);
      await updateBadge();
      await broadcast({ type: "taw:refresh" });
      return true;
    }
    case "track": return trackEvent(message.name, message.value);
    case "library": return library(message.cached);
    case "collection": return load<Collection>(`/api/extension/collection?kind=${message.kind}&id=${encodeURIComponent(message.id)}`);
    case "search": return load<SearchResult>(`/api/extension/search?q=${encodeURIComponent(message.q.slice(0, 200))}`);
    case "wallet": return /^[a-f0-9]{24}$/i.test(message.id) ? load<WalletFiling>(`/api/extension/wallet?id=${message.id}`) : { data: null, error: "Pick a wallet." };
    case "open": return chrome.tabs.create({ url: API + message.path });
  }
}

chrome.runtime.onMessage.addListener((message: Message, sender, reply) => {
  if (message.type === "openRoute") {
    const tab = sender.tab;
    // Only a page's content script asks this, never one of our own pages.
    if (!tab?.id || tab.windowId === undefined || sender.url?.startsWith(chrome.runtime.getURL("")) || !validRoute(message.route)) { reply({ opened: false }); return false; }
    if (panelMode !== "side") { reply({ opened: false }); return false; }
    // Called before anything else, while the click on the page still counts as a user gesture.
    const opening = chrome.sidePanel.open({ windowId: tab.windowId });
    const tabId = tab.id;
    void chrome.storage.session.set({ [`route:${tabId}`]: message.route });
    void chrome.runtime.sendMessage({ type: "taw:route", tabId, route: message.route } satisfies PanelMessage).catch(() => {});
    opening.then(() => reply({ opened: true }), () => reply({ opened: false }));
    return true;
  }
  if (message.type === "takeRoute") {
    // Our side panel collects what a page asked for before it was open. Pages can't read it back.
    if (!sender.url?.startsWith(chrome.runtime.getURL("panel.html"))) { reply(null); return false; }
    const key = `route:${message.tabId}`;
    void chrome.storage.session.get(key).then(async (r) => { await chrome.storage.session.remove(key); reply(r[key] ?? null); });
    return true;
  }
  // Both need the sender's tab, which only the listener sees.
  if (message.type === "floatNonce" || message.type === "checkFloat") {
    const tabId = sender.tab?.id;
    if (tabId === undefined || typeof message.nonce !== "string") { reply(false); return false; }
    const key = `float:${tabId}`;
    if (message.type === "floatNonce") {
      // Only the content script, which runs in the page itself, may register one. Never an extension frame.
      if (sender.url?.startsWith(chrome.runtime.getURL(""))) { reply(false); return false; }
      void chrome.storage.session.set({ [key]: message.nonce }).then(() => reply(true));
      return true;
    }
    // The check must come from our own panel page, framed in that same tab.
    if (!sender.url?.startsWith(chrome.runtime.getURL("panel.html"))) { reply(false); return false; }
    void chrome.storage.session.get(key).then((r) => reply(!!message.nonce && r[key] === message.nonce));
    return true;
  }
  if (message.type === "pageSummary") {
    // Only tabs the content script runs in can report, so the tab id always comes from the sender.
    if (sender.tab?.id !== undefined) void storePage(sender.tab.id, message.summary);
    reply(true);
    return false;
  }
  handle(message).then(reply, (err) => reply({ ok: false, error: String(err?.message ?? err) }));
  return true;
});

// The badge follows the tab in front. A navigation clears the old page's count until the new page reports.
chrome.tabs.onActivated.addListener(({ tabId }) => void updateBadge(tabId));
chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.status === "loading") void chrome.storage.session.remove(pageKey(tabId)).then(() => updateBadge(tabId));
  // A new address means a new document, so any floating frame from the old one is gone.
  if (info.url) void chrome.storage.session.remove(`float:${tabId}`);
});
chrome.tabs.onRemoved.addListener((tabId) => void chrome.storage.session.remove([pageKey(tabId), `float:${tabId}`, `route:${tabId}`]));

// The token arrives only from our own site, over the channel the manifest allows.
chrome.runtime.onMessageExternal.addListener((message, sender, reply) => {
  if (sender.origin !== new URL(API).origin || message?.type !== "tagawallet:connect" || typeof message.token !== "string") {
    reply({ ok: false });
    return;
  }
  (async () => {
    await chrome.storage.local.remove("handleIndex");
    await chrome.storage.local.remove("authExpired");
    await chrome.storage.local.remove("library"); // Another account's lists must never show.
    await set({ token: message.token, cache: {} });
    await refreshBootstrap(true);
    await flushQueue();
    await updateBadge();
    await trackEvent("extension_installed");
    await broadcast({ type: "taw:refresh" });
    reply({ ok: true });
  })();
  return true;
});

// ---- Right-click: tag a selected address on any page. The click grants activeTab, so no site access is needed. ----

function setupBackgroundJobs() {
  void getSettings().then((s) => applyPanelMode(s.panelMode));
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: MENU_ID, title: "Tag “%s” with TagAWallet", contexts: ["selection"] });
  });
  // Service workers sleep, so an alarm makes sure queued tags sync even if the person never opens a page.
  void chrome.alarms.create(FLUSH_ALARM, { periodInMinutes: 5 });
  void updateBadge();
}

async function tagSelection(tab: chrome.tabs.Tab | undefined, frameId: number | undefined, text: string) {
  if (!tab?.id || !/^https?:/.test(tab.url ?? "")) return;
  const target = { tabId: tab.id, frameIds: [frameId ?? 0] };
  await chrome.scripting.executeScript({ target, files: ["content.js"] }).catch(() => {});
  await chrome.tabs.sendMessage(tab.id, { type: "taw:tagSelection", text } satisfies TabMessage, { frameId: frameId ?? 0 }).catch(() => {});
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === MENU_ID && info.selectionText) void tagSelection(tab, info.frameId, info.selectionText);
});
chrome.alarms.onAlarm.addListener((alarm) => { if (alarm.name === FLUSH_ALARM) void flushQueue(); });
// A keyboard shortcut counts as a user gesture, so it may open the panel directly.
chrome.commands.onCommand.addListener((command, tab) => {
  if (command === "open-side-panel" && tab?.windowId !== undefined) void chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {});
});

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  setupBackgroundJobs();
  await refreshSites();
  await syncContentScripts();
  if (reason === "install") chrome.tabs.create({ url: chrome.runtime.getURL("welcome.html") });
});
chrome.runtime.onStartup.addListener(() => { setupBackgroundJobs(); void refreshBootstrap(true); void refreshSites(); void syncContentScripts(); void flushQueue(); });
chrome.permissions.onAdded.addListener(() => void syncContentScripts());
chrome.permissions.onRemoved.addListener(() => void syncContentScripts());
self.addEventListener("online", () => void flushQueue());


