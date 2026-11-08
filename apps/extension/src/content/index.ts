import { detectAddresses, xHandleFromPath, type DetectedAddress, type HandleEntry } from "@tagawallet/shared/lite";
import { chainFromLocation, send, type Detected, type QueryAddress, type ResolvedLabel, type Settings, type TabMessage } from "../lib/messages";
import { attachChip, CHIP_TAG, openCard, openNotice, closeCard, updateChip, type ChipHandle } from "./ui";

const HOST = location.hostname;
const SKIP = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT", "SELECT", "OPTION", "SVG", "CANVAS", "IFRAME", CHIP_TAG.toUpperCase()]);
const ATTRS = "a[href],[title],[data-address],[data-clipboard-text],[data-highlight-target]";
const BLOCK = "tr, li, article, p, h1, h2, h3, h4, td, th, [role=row]";
const MAX_NODES = 20000;
const SHADOW_CAP = 1500;

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

function blockOf(node: Node): Element | null {
  const el = node instanceof Element ? node : node.parentElement;
  return el?.closest(BLOCK) ?? el;
}

function alreadyInBlock(found: DetectedAddress, parent: Node): boolean {
  const block = blockOf(parent);
  if (!block) return false;
  return !!block.querySelector(`${CHIP_TAG}[data-address="${CSS.escape(found.normalized)}"]`);
}

function insertChip(found: DetectedAddress, parent: Node | null, before: Node | null) {
  if (!parent || alreadyInBlock(found, parent)) return;
  const handle = attachChip(found, parent, before, (h) => void onChipClick(h));
  if (!chips.has(found.normalized)) chips.set(found.normalized, new Set());
  chips.get(found.normalized)!.add(handle);
  detected.set(found.normalized, found);
}

/** Splits the text so the chip sits immediately after the address. Rightmost match first, so earlier indexes stay valid. */
function placeAddresses(node: Text, founds: DetectedAddress[]) {
  const text = node.nodeValue ?? "";
  const spots = founds.flatMap((found) => {
    const index = text.toLowerCase().indexOf(found.raw.toLowerCase());
    return index < 0 ? [] : [{ found, index }];
  }).sort((a, b) => b.index - a.index);
  if (!spots.length) { seenText.set(node, text); return; }
  const anchor = anchorFor(node);
  if (anchor !== node) {
    seenText.set(node, text);
    for (const spot of spots) insertChip(spot.found, anchor.parentNode, anchor.nextSibling);
    return;
  }
  let current = node;
  for (const spot of spots) {
    const value = current.nodeValue ?? "";
    const end = spot.index + spot.found.raw.length;
    if (end < value.length) {
      const rest = current.splitText(end);
      seenText.set(rest, rest.nodeValue ?? "");
      insertChip(spot.found, current.parentNode, rest);
    } else {
      insertChip(spot.found, current.parentNode, current.nextSibling);
    }
  }
  seenText.set(current, current.nodeValue ?? "");
}

async function onChipClick(handle: ChipHandle) {
  void send({ type: "track", name: "inline_chip_click" });
  // Keyed by what was on the page: a name keeps its labels even after its chip points at the address behind it.
  const key = handle.host.getAttribute("data-address") ?? handle.found.normalized;
  await openCard(handle.host, handle.found, labels.get(key) ?? [], settings!, HOST);
}

function scan(root: Node) {
  const fresh = new Set<string>();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let count = 0;
  for (let n = walker.nextNode(); n && count < MAX_NODES; n = walker.nextNode(), count++) {
    const text = n.nodeValue ?? "";
    if (text.length < 5 || seenText.get(n) === text) continue;
    if (skipped(n.parentElement)) { seenText.set(n, text); continue; }
    const founds = detectAddresses(text);
    if (!founds.length) { seenText.set(n, text); continue; }
    if (n instanceof Text) placeAddresses(n, founds);
    else seenText.set(n, text);
    for (const found of founds) fresh.add(found.normalized);
  }
  if (root instanceof Element || root instanceof Document || root instanceof ShadowRoot) {
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
        const anchor = anchorFor(el);
        insertChip(found, anchor.parentNode, anchor.nextSibling);
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
  await attachNameAddresses(Object.keys(result));
  if (known && !viewedKnown) {
    viewedKnown = true;
    void send({ type: "track", name: "first_inline_tag_viewed" });
  }
  void send({ type: "track", name: "inline_chip_impression", value: addresses.length });
}

/** An ENS name that resolves on-chain gets a chip for the address behind it, so it can be tagged right there. */
async function attachNameAddresses(keys: string[]) {
  const names = keys.filter((k) => detected.get(k)?.kind === "ens");
  if (!names.length) return;
  const addresses = await send<Record<string, string>>({ type: "names", names });
  for (const [name, address] of Object.entries(addresses ?? {})) {
    for (const h of chips.get(name) ?? []) {
      h.found = { raw: address, normalized: address.toLowerCase(), kind: "evm" };
      updateChip(h, labels.get(name) ?? [], settings!);
      h.button.title = `${name} → ${address}. ${h.button.title}`;
    }
  }
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
    const at = headerHandle(main, entry.handle);
    if (at?.parentNode) placeHandle(entry, at.parentNode, at.nextSibling)?.setAttribute(PROFILE_ATTR, "");
  }
  let links = 0;
  for (const a of main.querySelectorAll<HTMLAnchorElement>('a[href^="/"]')) {
    if (++links > 200) break;
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

/** Profile @handle only. Stops before a long timeline, and never walks every span. */
function headerHandle(main: Element, handle: string): Element | null {
  const target = `@${handle}`;
  const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
  let steps = 0;
  for (let n = walker.nextNode(); n && steps < 400; n = walker.nextNode(), steps++) {
    if ((n.nodeValue ?? "").trim().toLowerCase() !== target) continue;
    const el = n.parentElement;
    if (!el || el.childElementCount !== 0 || el.closest("a, article")) continue;
    return el;
  }
  return null;
}

let generation = 0;
const observedGen = new WeakMap<Node, number>();

function observe(root: Node) {
  if (observedGen.get(root) === generation) return;
  observedGen.set(root, generation);
  observer.observe(root, { childList: true, subtree: true, characterData: true });
}

/** Open shadow roots are invisible to a document walker, so each one is scanned and watched on its own. */
function scanShadows(root: Node, fresh: Set<string>, left = { n: SHADOW_CAP }) {
  if (left.n <= 0 || !(root instanceof Element || root instanceof Document || root instanceof ShadowRoot)) return;
  for (const el of root.querySelectorAll("*")) {
    if (left.n <= 0) return;
    if (el.tagName.toLowerCase() === CHIP_TAG || !el.shadowRoot) continue;
    left.n--;
    observe(el.shadowRoot);
    for (const a of scan(el.shadowRoot)) fresh.add(a);
    scanShadows(el.shadowRoot, fresh, left);
  }
}

function runScan(root: Node) {
  try {
    const fresh = scan(root);
    // A full shadow walk only happens for the document and for a shadow root we were handed.
    // Everyday mutations stay on the subtree that changed.
    if (root === document.body || root instanceof ShadowRoot) scanShadows(root, fresh);
    void lookup([...fresh].filter((a) => !labels.has(a)));
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
      if (n instanceof Element) noteShadows(n);
    }
  }
  if (pending.size) schedule();
});

function noteShadows(el: Element) {
  const take = (host: Element) => {
    if (!host.shadowRoot || host.tagName.toLowerCase() === CHIP_TAG) return;
    observe(host.shadowRoot);
    pending.add(host.shadowRoot);
  };
  take(el);
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_ELEMENT);
  let i = 0;
  for (let n = walker.nextNode(); n && i < 200; n = walker.nextNode(), i++) take(n as Element);
}

function start() {
  if (active) return;
  active = true;
  runScan(document.body);
  void loadHandles();
  observe(document.body);
}

function stop() {
  active = false;
  generation++;
  observer.disconnect();
  closeCard();
  for (const set of chips.values()) for (const h of set) h.host.remove();
  for (const h of handleChips) h.host.remove();
  handleChips.clear();
  chips.clear(); labels.clear(); detected.clear();
  // Forget what was scanned, so turning it back on finds everything again.
  forget(document.body);
}
function forget(root: Node) {
  if (!(root instanceof Element || root instanceof Document || root instanceof ShadowRoot)) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) seenText.delete(n);
  root.querySelectorAll(ATTRS).forEach((e) => seenAttr.delete(e));
  for (const el of root.querySelectorAll("*")) if (el.shadowRoot) forget(el.shadowRoot);
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

// ---- Right-click "Tag with TagAWallet". Works on any page the person invokes it on, even one that isn't turned on. ----

let selectionAnchor: HTMLElement | null = null;
/** A stand-in element over the selection, since the card positions itself against an element. */
function anchorAtSelection(): HTMLElement {
  const rect = getSelection()?.rangeCount ? getSelection()!.getRangeAt(0).getBoundingClientRect() : null;
  selectionAnchor?.remove();
  const a = document.createElement("tagawallet-anchor");
  const r = rect && rect.width + rect.height > 0 ? rect : new DOMRect(innerWidth / 2 - 150, 80, 0, 0);
  Object.assign(a.style, { position: "fixed", left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`, pointerEvents: "none" });
  document.documentElement.append(a);
  selectionAnchor = a;
  return a;
}

async function tagSelection(text: string) {
  if (!settings) settings = (await send<{ settings: Settings }>({ type: "contentState", host: HOST })).settings;
  const anchor = anchorAtSelection();
  const found = detectAddresses(text)[0];
  if (!found) {
    openNotice(anchor, settings, "No wallet address selected", "Select a full EVM, Solana or Bitcoin address, then right-click it again.");
    return;
  }
  if (found.kind === "ens" || found.kind === "sns") {
    openNotice(anchor, settings, "That's a name, not an address", "Open the name on an explorer and tag the address it points to.");
    return;
  }
  const result = await send<Record<string, ResolvedLabel[]>>({ type: "resolve", addresses: [{ normalized: found.normalized, kind: found.kind as QueryAddress["kind"] }] });
  const list = result?.[found.normalized] ?? [];
  // Open straight on the form: the person asked to tag it.
  await openCard(anchor, found, list, settings, HOST, { edit: true });
}

function onTabMessage(message: TabMessage, _sender: chrome.runtime.MessageSender, reply: (r: unknown) => void) {
  if (message.type === "taw:tagSelection") { void tagSelection(message.text); return; }
  if (message.type === "taw:settings") void applySettings();
  if (message.type === "taw:refresh" && active) {
    const all = [...chips.keys()];
    labels.clear();
    void lookup(all);
    void loadHandles();
  }
  if (message.type === "taw:scan") {
    const list: Detected[] = [...detected.values()].map((d) => ({
      raw: d.raw, normalized: d.normalized, kind: d.kind as Detected["kind"], chain: chainFromLocation(HOST, location.pathname + location.search, d.kind), labels: labels.get(d.normalized) ?? [],
    }));
    const current = IS_X ? handleEntries.get(xHandleFromPath(location.pathname) ?? "") : undefined;
    if (current) {
      const f = foundFor(current);
      list.unshift({ raw: f.raw, normalized: f.normalized, kind: f.kind as Detected["kind"], chain: current.labels[0]?.chain ?? "ethereum", labels: current.labels });
    }
    reply({ detected: list.filter((d, i) => list.findIndex((o) => o.normalized === d.normalized) === i) });
  }
}

// The script can be injected more than once (popup, right-click). Only the first copy listens, so nothing runs twice.
if (!(window as unknown as { __tagawallet?: boolean }).__tagawallet) {
  (window as unknown as { __tagawallet?: boolean }).__tagawallet = true;
  chrome.runtime.onMessage.addListener(onTabMessage);
  void applySettings();
}
