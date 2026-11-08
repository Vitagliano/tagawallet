import { CURATED_SITES, chainFamily, normalizeAddress, provenanceText, sanitizeUrl, type ChainId, type HandleEntry, type ResolvedLabel } from "@tagawallet/shared/lite";
import { DEFAULT_SETTINGS, isUntag, type AuthState, type Bootstrap, type FailedTag, type Message, type QueryAddress, type QueueItem, type Settings, type Status, type TabMessage, type TagInput, type TagResult, type UntagResult } from "./lib/messages";

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
  /** Set when the server rejected our token, so the person is told instead of silently signed out. */
  authExpired?: boolean;
};

const get = <K extends keyof Local>(...keys: K[]) => chrome.storage.local.get(keys) as Promise<Pick<Local, K>>;
const set = (patch: Local) => chrome.storage.local.set(patch);
const getSettings = async () => ({ ...DEFAULT_SETTINGS, ...(await get("settings")).settings });

class AuthError extends Error {}
class NetworkError extends Error {}

const normalizedOf = (q: { address: string; chain: string }) => normalizeAddress(q.address, chainFamily(q.chain as ChainId));

/** The toolbar badge: "!" when the session ended, otherwise how many changes are waiting or need attention. */
async function updateBadge() {
  const { authExpired, queue = [], failed = [] } = await get("authExpired", "queue", "failed");
  const text = authExpired ? "!" : queue.length + failed.length ? String(queue.length + failed.length) : "";
  await chrome.action.setBadgeText({ text }).catch(() => {});
  await chrome.action.setBadgeBackgroundColor({ color: authExpired || failed.length ? "#b3261e" : "#6a675e" }).catch(() => {});
  await chrome.action.setTitle({ title: authExpired ? "TagAWallet: session expired. Click to reconnect." : failed.length ? `TagAWallet: ${failed.length} tag${failed.length === 1 ? "" : "s"} couldn't be saved` : "TagAWallet" }).catch(() => {});
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

function localLabel(input: TagInput, listName: string | null): ResolvedLabel {
  return {
    source: "private", provenance: `${provenanceText("private")} · not synced yet`, label: input.displayLabel, chain: input.chain,
    tags: input.tags ?? [], status: input.status, notes: input.notes, shared: false, listName: listName ?? undefined,
    links: (input.links ?? []).filter((l) => sanitizeUrl(l.url)).map((l) => ({ type: l.type, url: l.url, label: l.label })),
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
    localTags[normalized] = { input: withDefault, label: localLabel(withDefault, fallbackName) };
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
      await set({ settings: { ...remote, disabledSites: local.disabledSites, enabledSites: local.enabledSites, cloudSync: local.cloudSync } });
    }
    return bootstrap;
  } catch {
    return (await get("bootstrap")).bootstrap ?? null;
  }
}

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
      const { disabledSites: _d, enabledSites: _e, cloudSync: _c, ...synced } = message.patch;
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
      await chrome.storage.local.remove(["token", "bootstrap", "cache", "handleIndex", "authExpired"]);
      await updateBadge();
      await broadcast({ type: "taw:refresh" });
      return true;
    }
    case "track": return trackEvent(message.name, message.value);
    case "open": return chrome.tabs.create({ url: API + message.path });
  }
}

chrome.runtime.onMessage.addListener((message: Message, _sender, reply) => {
  handle(message).then(reply, (err) => reply({ ok: false, error: String(err?.message ?? err) }));
  return true;
});

// The token arrives only from our own site, over the channel the manifest allows.
chrome.runtime.onMessageExternal.addListener((message, sender, reply) => {
  if (sender.origin !== new URL(API).origin || message?.type !== "tagawallet:connect" || typeof message.token !== "string") {
    reply({ ok: false });
    return;
  }
  (async () => {
    await chrome.storage.local.remove("handleIndex");
    await chrome.storage.local.remove("authExpired");
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


