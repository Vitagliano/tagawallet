import { CURATED_SITES, chainFamily, normalizeAddress, provenanceText, sanitizeUrl, type ChainId, type HandleEntry, type ResolvedLabel } from "@tagawallet/shared/lite";
import { DEFAULT_SETTINGS, type Bootstrap, type Message, type QueryAddress, type Settings, type TabMessage, type TagInput, type TagResult } from "./lib/messages";

const API = __API_BASE__;
const CACHE_TTL = 5 * 60_000;
const CACHE_MAX = 5000;
const SCRIPT_ID = "tagawallet-content";

type CacheEntry = { labels: ResolvedLabel[]; expires: number };
type Local = {
  token?: string; settings?: Settings; cache?: Record<string, CacheEntry>; queue?: TagInput[];
  localTags?: Record<string, { input: TagInput; label: ResolvedLabel }>; sites?: string[]; bootstrap?: Bootstrap;
  handleIndex?: { entries: HandleEntry[]; expires: number };
};

const get = <K extends keyof Local>(...keys: K[]) => chrome.storage.local.get(keys) as Promise<Pick<Local, K>>;
const set = (patch: Local) => chrome.storage.local.set(patch);
const getSettings = async () => ({ ...DEFAULT_SETTINGS, ...(await get("settings")).settings });

class AuthError extends Error {}
class NetworkError extends Error {}

async function call<T>(path: string, init?: { method?: string; body?: unknown }, tokenOverride?: string): Promise<T> {
  const token = tokenOverride ?? (await get("token")).token;
  if (!token) throw new AuthError();
  let res: Response;
  try {
    res = await fetch(API + path, {
      method: init?.method ?? (init?.body ? "POST" : "GET"),
      headers: { Authorization: `Bearer ${token}`, ...(init?.body ? { "Content-Type": "application/json" } : {}) },
      body: init?.body ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new NetworkError();
  }
  if (res.status === 401) {
    await chrome.storage.local.remove(["token", "bootstrap"]);
    throw new AuthError();
  }
  const data = await res.json().catch(() => ({}));
  if (res.status >= 500 || res.status === 429) throw new NetworkError();
  if (!res.ok) throw new Error(data.error ?? "Couldn't save that.");
  return data;
}

async function broadcast(message: TabMessage) {
  const tabs = await chrome.tabs.query({});
  await Promise.all(tabs.map((t) => (t.id ? chrome.tabs.sendMessage(t.id, message).catch(() => {}) : null)));
}

function localLabel(input: TagInput, listName: string): ResolvedLabel {
  return {
    source: "private", provenance: `${provenanceText("private")} · not synced yet`, label: input.displayLabel, chain: input.chain,
    tags: input.tags ?? [], status: input.status, notes: input.notes, shared: false, listName,
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
        const { results } = await call<{ results: { normalized: string; labels: ResolvedLabel[] }[] }>("/api/extension/resolve", { body: { addresses: missing.slice(i, i + 200) } });
        for (const r of results) {
          out[r.normalized] = r.labels;
          cache[r.normalized] = { labels: r.labels, expires: now + CACHE_TTL };
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
    const { entries } = await call<{ entries: HandleEntry[] }>("/api/extension/handles");
    await set({ handleIndex: { entries, expires: Date.now() + 60_000 } });
    return entries;
  } catch {
    return cached?.entries ?? [];
  }
}

// ---- Quick tagging. Saved locally first, so it works offline and syncs later. ----

async function tag(input: TagInput): Promise<TagResult> {
  const settings = await getSettings();
  const { token, queue = [], localTags = {}, bootstrap } = await get("token", "queue", "localTags", "bootstrap");
  if (!token && settings.cloudSync) return { ok: false, needsAccount: true, error: "Connect your account first." };
  const family = chainFamily(input.chain as ChainId);
  const normalized = normalizeAddress(input.address, family);
  const withDefault = { ...input, listId: input.listId ?? settings.defaultListId ?? undefined };
  const fallbackName = input.newListName ?? bootstrap?.lists.find((l) => l.id === withDefault.listId)?.name ?? "your list";

  const queueLocally = async () => {
    localTags[normalized] = { input: withDefault, label: localLabel(withDefault, fallbackName) };
    await set({ localTags, queue: [...queue.filter((q) => normalizeAddress(q.address, chainFamily(q.chain as ChainId)) !== normalized), withDefault] });
    await broadcast({ type: "taw:refresh" });
  };
  if (!settings.cloudSync) {
    await queueLocally();
    return { ok: true, queued: true, listName: "this browser", shared: false };
  }
  try {
    const r = await call<{ listName: string; shared: boolean }>("/api/extension/tags", { body: withDefault });
    delete localTags[normalized];
    const { cache = {} } = await get("cache");
    delete cache[normalized];
    await set({ cache, localTags });
    await broadcast({ type: "taw:refresh" });
    void refreshBootstrap();
    return { ok: true, queued: false, listName: r.listName, shared: r.shared };
  } catch (err) {
    if (err instanceof NetworkError) {
      await queueLocally();
      return { ok: true, queued: true, listName: fallbackName, shared: false };
    }
    if (err instanceof AuthError) return { ok: false, needsAccount: true, error: "Your session ended. Connect your account again." };
    return { ok: false, error: (err as Error).message };
  }
}

async function flushQueue() {
  const settings = await getSettings();
  const { queue = [], token, localTags = {}, cache = {} } = await get("queue", "token", "localTags", "cache");
  if (!queue.length || !token || !settings.cloudSync) return;
  const remaining: TagInput[] = [];
  for (const [i, item] of queue.entries()) {
    const normalized = normalizeAddress(item.address, chainFamily(item.chain as ChainId));
    try {
      await call("/api/extension/tags", { body: item });
      delete localTags[normalized];
      delete cache[normalized];
    } catch (err) {
      if (err instanceof NetworkError || err instanceof AuthError) { remaining.push(...queue.slice(i)); break; }
      // The server rejected it outright. Retrying can't help, so keep only the local label.
      console.warn("Dropped a queued tag the server rejected", err);
    }
  }
  await set({ queue: remaining, localTags, cache });
  if (remaining.length !== queue.length) await broadcast({ type: "taw:refresh" });
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
    case "tag": await chrome.storage.local.remove("handleIndex"); return tag(message.input);
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
      const { token, queue = [], sites } = await get("token", "queue", "sites");
      return { connected: !!token, queued: queue.length, sites: sites ?? CURATED_SITES, apiBase: API };
    }
    case "sites": return refreshSites();
    case "flush": await flushQueue(); return (await get("queue")).queue?.length ?? 0;
    case "signOut": {
      const { token } = await get("token");
      if (token) await fetch(`${API}/api/auth/logout`, { method: "POST", headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
      await chrome.storage.local.remove(["token", "bootstrap", "cache", "handleIndex"]);
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
    await set({ token: message.token, cache: {} });
    await refreshBootstrap(true);
    await flushQueue();
    await trackEvent("extension_installed");
    await broadcast({ type: "taw:refresh" });
    reply({ ok: true });
  })();
  return true;
});

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  await refreshSites();
  await syncContentScripts();
  if (reason === "install") chrome.tabs.create({ url: chrome.runtime.getURL("welcome.html") });
});
chrome.runtime.onStartup.addListener(() => { void refreshBootstrap(true); void refreshSites(); void syncContentScripts(); void flushQueue(); });
chrome.permissions.onAdded.addListener(() => void syncContentScripts());
chrome.permissions.onRemoved.addListener(() => void syncContentScripts());
self.addEventListener("online", () => void flushQueue());


