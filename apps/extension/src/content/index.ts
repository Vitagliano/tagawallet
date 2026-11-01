import { detectAddresses, xHandleFromPath, type DetectedAddress, type HandleEntry } from "@tagawallet/shared/lite";
import { chainFromHost, send, type Detected, type QueryAddress, type ResolvedLabel, type Settings, type TabMessage } from "../lib/messages";
import { attachChip, CHIP_TAG, openCard, closeCard, updateChip, type ChipHandle } from "./ui";

const HOST = location.hostname;
const SKIP = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT", "SELECT", "OPTION", "SVG", "CANVAS", "IFRAME", CHIP_TAG.toUpperCase()]);
const ATTRS = "a[href],[title],[data-address],[data-clipboard-text],[data-highlight-target]";
const MAX_NODES = 20000;

let settings: Settings | null = null;
let active = false;
const seenText = new WeakMap<Node, string>();
const seenAttr = new WeakMap<Element, string>();
const chips = new Map<string, Set<ChipHandle>>();
const labels = new Map<string, ResolvedLabel[]>();
const detected = new Map<string, DetectedAddress>();
let viewedKnown = false;

function skipped(el: Element | null) {
  for (let e = el; e; e = e.parentElement) {
    if (SKIP.has(e.tagName) || (e as HTMLElement).isContentEditable) return true;
  }
  return false;
}

/** Puts the chip beside a link or button rather than inside it, so a click can't trigger the host's control. */
function anchorFor(node: Node): Node {
  const el = node instanceof Element ? node : node.parentElement;
  return el?.closest("a,button,[role=button],[role=link]") ?? node;
}

function place(found: DetectedAddress, after: Node) {
  const parent = after.parentNode;
  if (!parent) return;
  // Already labelled right here? Common when a row repeats an address in text and in its link.
  for (let n = after.nextSibling, i = 0; n && i < 2; n = n.nextSibling, i++) {
    if (n instanceof Element && n.tagName.toLowerCase() === CHIP_TAG && n.getAttribute("data-address") === found.normalized) return;
  }
  const handle = attachChip(found, parent, after.nextSibling, (h) => void onChipClick(h));
  if (!chips.has(found.normalized)) chips.set(found.normalized, new Set());
  chips.get(found.normalized)!.add(handle);
  detected.set(found.normalized, found);
}

async function onChipClick(handle: ChipHandle) {
  void send({ type: "track", name: "inline_chip_click" });
  await openCard(handle.host, handle.found, labels.get(handle.found.normalized) ?? [], settings!, HOST);
}

function scan(root: Node) {
  const fresh = new Set<string>();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let count = 0;
  for (let n = walker.nextNode(); n && count < MAX_NODES; n = walker.nextNode(), count++) {
    const text = n.nodeValue ?? "";
    if (text.length < 5 || seenText.get(n) === text) continue;
    seenText.set(n, text);
    if (skipped(n.parentElement)) continue;
    for (const found of detectAddresses(text)) {
      place(found, anchorFor(n));
      fresh.add(found.normalized);
    }
  }
  if (root instanceof Element || root instanceof Document) {
    const els = root.querySelectorAll(ATTRS);
    for (let i = 0; i < els.length && i < MAX_NODES; i++) {
      const el = els[i]!;
      if (el.tagName.toLowerCase() === CHIP_TAG || skipped(el)) continue;
      const value = [el.getAttribute("href"), el.getAttribute("title"), el.getAttribute("data-address"), el.getAttribute("data-clipboard-text"), el.getAttribute("data-highlight-target")].filter(Boolean).join(" ");
      if (seenAttr.get(el) === value) continue;
      seenAttr.set(el, value);
      // Split URLs on separators, so an address in a path counts but a query blob doesn't merge into it.
      for (const found of detectAddresses(value.replace(/[/?#&=]/g, " "))) {
        if (el.textContent?.toLowerCase().includes(found.raw.toLowerCase())) continue; // the text pass handled it
        place(found, anchorFor(el));
        fresh.add(found.normalized);
      }
    }
  }
  return fresh;
}

async function lookup(addresses: string[]) {
  if (!addresses.length) return;
  const queries: QueryAddress[] = addresses.map((normalized) => ({ normalized, kind: detected.get(normalized)!.kind as QueryAddress["kind"] }));
  const result = await send<Record<string, ResolvedLabel[]>>({ type: "resolve", addresses: queries });
  if (!result) return;
  let known = 0;
  for (const [address, list] of Object.entries(result)) {
    labels.set(address, list);
    for (const handle of chips.get(address) ?? []) updateChip(handle, list, settings!);
    if (list.length) known++;
  }
  if (known && !viewedKnown) {
    viewedKnown = true;
    void send({ type: "track", name: "first_inline_tag_viewed" });
  }
  void send({ type: "track", name: "inline_chip_impression", value: addresses.length });
}

// ---- X accounts. Matching happens here against the downloaded index, and handles are never sent anywhere. ----

const IS_X = /(^|\.)(x|twitter)\.com$/.test(HOST);
const HANDLE_ATTR = "data-tagawallet-handle";
let handleEntries = new Map<string, HandleEntry>();
const handleChips = new Set<ChipHandle>();

const foundFor = (e: HandleEntry): DetectedAddress => e.address
  ? { raw: e.address, normalized: e.normalized!, kind: e.family! }
  : { raw: `@${e.handle}`, normalized: `x:${e.handle}`, kind: "x" as never };

function placeHandle(entry: HandleEntry, parent: Node, before: Node | null) {
  const handle = attachChip(foundFor(entry), parent, before, (h) => {
    void send({ type: "track", name: "inline_chip_click" });
    void openCard(h.host, h.found, entry.labels, settings!, HOST);
  });
  handle.host.setAttribute(HANDLE_ATTR, entry.handle);
  updateChip(handle, entry.labels, settings!);
  handleChips.add(handle);
  return handle.host;
}

const PROFILE_ATTR = "data-tagawallet-profile";
const handleOfLink = (a: Element | null) => (a instanceof HTMLAnchorElement ? xHandleFromPath(a.getAttribute("href") ?? "") : null);

// X doesn't reliably serve test ids or stable classes, so this keys only on what people see:
// the @handle text in a profile header, and links whose text is @handle.
function scanHandles() {
  if (!IS_X || !handleEntries.size) return;
  const current = xHandleFromPath(location.pathname);
  // X reuses elements as you navigate, so a chip can end up beside the wrong account.
  for (const h of handleChips) {
    const owner = h.host.getAttribute(HANDLE_ATTR);
    const stale = !h.host.isConnected || (h.host.hasAttribute(PROFILE_ATTR) ? owner !== current : handleOfLink(h.host.previousElementSibling) !== owner);
    if (stale) { h.host.remove(); handleChips.delete(h); }
  }
  const main = document.querySelector("main");
  if (!main) return;
  const entry = current ? handleEntries.get(current) : undefined;
  if (entry && !main.querySelector(`${CHIP_TAG}[${PROFILE_ATTR}]`)) {
    const target = `@${entry.handle}`;
    const at = [...main.querySelectorAll("span,div")].find((e) => e.childElementCount === 0 && e.textContent?.trim().toLowerCase() === target && !e.closest("a,article"));
    if (at?.parentNode) placeHandle(entry, at.parentNode, at.nextSibling)?.setAttribute(PROFILE_ATTR, "");
  }
  for (const a of main.querySelectorAll<HTMLAnchorElement>('a[href^="/"]')) {
    const handle = handleOfLink(a);
    const match = handle ? handleEntries.get(handle) : undefined;
    if (!match || a.getAttribute("href")!.split("/").length !== 2 || a.textContent?.trim().toLowerCase() !== `@${handle}`) continue;
    const next = a.nextElementSibling;
    if (next?.tagName.toLowerCase() === CHIP_TAG && next.hasAttribute(HANDLE_ATTR)) continue;
    placeHandle(match, a.parentNode!, a.nextSibling);
  }
}

async function loadHandles() {
  if (!IS_X) return;
  const entries = await send<HandleEntry[]>({ type: "handles" });
  handleEntries = new Map((entries ?? []).map((e) => [e.handle, e]));
  for (const h of handleChips) h.host.remove();
  handleChips.clear();
  scanHandles();
}

function runScan(root: Node) {
  try {
    scanHandles();
    void lookup([...scan(root)].filter((a) => !labels.has(a)));
  } catch (err) {
    console.debug("TagAWallet scan failed", err);
    void send({ type: "track", name: "content_script_error" });
  }
}

// Mutations are batched and handled when the page is idle, so busy feeds stay smooth.
const pending = new Set<Node>();
let timer: ReturnType<typeof setTimeout> | null = null;
function schedule() {
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    // The timeout matters: idle callbacks can otherwise wait indefinitely in background tabs.
    requestIdleCallback(() => {
      const nodes = [...pending];
      pending.clear();
      for (const n of nodes) if (n.isConnected) runScan(n);
      if (nodes.length) scanHandles();
    }, { timeout: 1000 });
  }, 250);
}

const observer = new MutationObserver((records) => {
  for (const r of records) {
    if (r.type === "characterData") { if (r.target.parentElement) pending.add(r.target.parentElement); continue; }
    for (const n of r.addedNodes) {
      if (n instanceof Element && n.tagName.toLowerCase() === CHIP_TAG) continue;
      pending.add(n.nodeType === Node.TEXT_NODE && n.parentElement ? n.parentElement : n);
    }
  }
  if (pending.size) schedule();
});

function start() {
  if (active) return;
  active = true;
  runScan(document.body);
  void loadHandles();
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
}

function stop() {
  active = false;
  observer.disconnect();
  closeCard();
  for (const set of chips.values()) for (const h of set) h.host.remove();
  for (const h of handleChips) h.host.remove();
  handleChips.clear();
  chips.clear(); labels.clear(); detected.clear();
  // Forget what was scanned, so turning it back on finds everything again.
  rescanAll();
}
function rescanAll() {
  // WeakMaps have no clear. A tree walk resets the entries that matter.
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) seenText.delete(n);
  document.querySelectorAll(ATTRS).forEach((e) => seenAttr.delete(e));
}

async function applySettings() {
  const state = await send<{ settings: Settings; active: boolean }>({ type: "contentState", host: HOST });
  settings = state.settings;
  const shouldRun = state.active && settings.chipsEnabled;
  if (shouldRun && !active) start();
  else if (!shouldRun && active) stop();
  else if (active) {
    for (const [a, set] of chips) for (const h of set) updateChip(h, labels.get(a) ?? [], settings);
    void loadHandles();
  }
  return state.active;
}

chrome.runtime.onMessage.addListener((message: TabMessage, _sender, reply) => {
  if (message.type === "taw:settings") void applySettings();
  if (message.type === "taw:refresh" && active) {
    const all = [...chips.keys()];
    labels.clear();
    void lookup(all);
    void loadHandles();
  }
  if (message.type === "taw:scan") {
    const list: Detected[] = [...detected.values()].map((d) => ({
      raw: d.raw, normalized: d.normalized, kind: d.kind as Detected["kind"], chain: chainFromHost(HOST, d.kind), labels: labels.get(d.normalized) ?? [],
    }));
    const current = IS_X ? handleEntries.get(xHandleFromPath(location.pathname) ?? "") : undefined;
    if (current) {
      const f = foundFor(current);
      list.unshift({ raw: f.raw, normalized: f.normalized, kind: f.kind as Detected["kind"], chain: current.labels[0]?.chain ?? "ethereum", labels: current.labels });
    }
    reply({ detected: list.filter((d, i) => list.findIndex((o) => o.normalized === d.normalized) === i) });
  }
});

if (!(window as unknown as { __tagawallet?: boolean }).__tagawallet) {
  (window as unknown as { __tagawallet?: boolean }).__tagawallet = true;
  void applySettings();
}
