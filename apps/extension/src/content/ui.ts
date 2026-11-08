import { CHAINS, LINK_TYPE_LABELS, linkHref, sanitizeUrl, truncateAddress, type DetectedAddress, type LinkType } from "@tagawallet/shared/lite";
import { send, type Bootstrap, type ResolvedLabel, type Settings, type Status, type UntagResult } from "../lib/messages";
import { buildTagForm, TAG_FORM_CSS } from "../lib/tag-form";

export const CHIP_TAG = "tagawallet-chip";
export interface ChipHandle { host: HTMLElement; found: DetectedAddress; button: HTMLButtonElement }

const MARK = "M3 4.5A1.5 1.5 0 0 1 4.5 3h7.4c.4 0 .8.16 1.06.44l7.6 7.6a1.5 1.5 0 0 1 0 2.12l-7.4 7.4a1.5 1.5 0 0 1-2.12 0l-7.6-7.6A1.5 1.5 0 0 1 3 11.9V4.5Z";

const THEME = `
  :host { all: initial; color-scheme: light; --bg:#fffefb; --fg:#1a1a18; --muted:#6a675e; --line:#dfdbcf; --wash:#efece2; --accent:#c8421b; --accent-fg:#fff; --good:#1b7a4a; --warn:#9a6a00; --bad:#b3261e; }
  :host([data-theme=dark]) { color-scheme: dark; --bg:#1c1c19; --fg:#efece3; --muted:#9c988b; --line:#33322c; --wash:#25241f; --accent:#ee6a42; --accent-fg:#1a0d07; --good:#55c58d; --warn:#dbab45; --bad:#f2837b; }
  * { box-sizing: border-box; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
`;

const CHIP_CSS = `${THEME}
  :host { display: inline; vertical-align: baseline; margin-left: 4px; }
  :host([hidden]) { display: none; }
  button { all: unset; box-sizing: border-box; display: inline-flex; align-items: center; gap: 4px; max-width: 200px; padding: 0 5px; line-height: 16px; height: 18px; border-radius: 4px; font: 500 11px/16px ui-sans-serif, system-ui, sans-serif; cursor: pointer; border: 1px solid var(--line); background: var(--bg); color: var(--fg); vertical-align: middle; white-space: nowrap; }
  button:hover { background: var(--wash); }
  button:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
  .t { overflow: hidden; text-overflow: ellipsis; }
  .unknown { width: 18px; padding: 0; justify-content: center; color: var(--muted); border-style: dashed; opacity: .72; }
  .unknown:hover, .unknown:focus-visible { opacity: 1; }
  .verified { border-color: var(--good); color: var(--good); }
  .self_claimed { border-color: var(--warn); color: var(--warn); }
  .shared { border-color: color-mix(in srgb, var(--warn) 55%, var(--line)); }
  .minimal { border-color: transparent; background: transparent; padding: 0 2px; }
  .minimal.unknown { opacity: .55; }
  svg { display: block; }
`;

/** System theme follows the page, so a dark explorer doesn't get a cream chip. An explicit choice wins. */
export function appearance(settings: Settings, sample?: Element | null): "light" | "dark" {
  if (settings.theme === "light" || settings.theme === "dark") return settings.theme;
  let el: Element | null = sample ?? document.body;
  for (let i = 0; el && i < 6; el = el.parentElement, i++) {
    const bg = getComputedStyle(el).backgroundColor;
    const m = bg.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?/);
    if (!m) continue;
    const alpha = m[4] === undefined ? 1 : Number(m[4]);
    if (alpha < 0.4) continue;
    const luminance = (0.2126 * Number(m[1]) + 0.7152 * Number(m[2]) + 0.0722 * Number(m[3])) / 255;
    return luminance < 0.42 ? "dark" : "light";
  }
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function tagMark() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "11");
  svg.setAttribute("height", "11");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", MARK);
  path.setAttribute("fill", "currentColor");
  svg.append(path);
  return svg;
}

const SOURCE_WORD: Record<string, string> = { private: "Your tag", shared: "Shared list", verified: "Verified", self_claimed: "Self-claimed" };

function chipParts(labels: ResolvedLabel[]) {
  const top = labels[0];
  if (!top) return { cls: "unknown", text: "", mark: true, title: "Not tagged yet. Click to tag it.", aria: "Tag this wallet" };
  // Verified gets a check. Every other source is told apart by color, and spelled out in the tooltip.
  const text = (top.source === "verified" ? "✓ " : "") + top.label;
  const word = SOURCE_WORD[top.source] ?? top.provenance;
  return { cls: top.source, text, mark: false, title: `${top.label} · ${word}`, aria: `TagAWallet: ${top.label}. ${top.provenance}` };
}

export function attachChip(found: DetectedAddress, parent: Node, before: Node | null, onClick: (h: ChipHandle) => void): ChipHandle {
  const host = document.createElement(CHIP_TAG);
  host.setAttribute("data-address", found.normalized);
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = CHIP_CSS;
  const button = document.createElement("button");
  button.type = "button";
  shadow.append(style, button);
  const handle: ChipHandle = { host, found, button };
  // Stop the event here, or a chip inside a table row would also trigger the row's own link.
  const handler = (e: Event) => { e.preventDefault(); e.stopPropagation(); };
  button.addEventListener("mousedown", handler);
  button.addEventListener("click", (e) => { handler(e); onClick(handle); });
  host.hidden = true; // Shown once its label is known, so unknowns don't flash.
  parent.insertBefore(host, before);
  return handle;
}

export function updateChip(h: ChipHandle, labels: ResolvedLabel[], s: Settings) {
  // A name with no label can't be tagged directly, since it isn't an address yet.
  const isName = h.found.kind === "ens" || h.found.kind === "sns" || (h.found.kind as string) === "x";
  h.host.hidden = s.chipStyle === "hidden" || (!labels.length && (isName || s.showUnknown === false));
  h.host.setAttribute("data-theme", appearance(s, h.host.parentElement));
  const p = chipParts(labels);
  const minimal = s.chipStyle === "minimal";
  h.button.className = `${p.cls}${minimal ? " minimal" : ""}`;
  h.button.title = p.title;
  h.button.setAttribute("aria-label", p.aria);
  const label = document.createElement("span");
  label.className = "t";
  label.textContent = minimal ? p.text.replace(/^✓\s/, "") : p.text;
  h.button.replaceChildren(p.mark ? tagMark() : label);
}

// ---- Card ----

const CARD_CSS = `${THEME}
  :host { position: fixed; z-index: 2147483647; inset: auto; }
  .card { width: 300px; max-width: calc(100vw - 16px); max-height: min(520px, calc(100vh - 16px)); overflow: auto; background: var(--bg); color: var(--fg); border: 1px solid var(--line); border-radius: 12px; box-shadow: 0 12px 40px rgb(0 0 0 / .18); padding: 12px; font-size: 13px; line-height: 1.4; transition: opacity 150ms ease; }
  h2 { margin: 0; font-size: 15px; font-weight: 600; overflow-wrap: anywhere; }
  .brand { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; font-size: 11px; font-weight: 600; letter-spacing: .01em; color: var(--muted); }
  .row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .between { justify-content: space-between; flex-wrap: nowrap; }
  .addr { font-family: ui-monospace, Menlo, monospace; font-size: 12px; color: var(--muted); }
  .muted { color: var(--muted); font-size: 12px; }
  .sec { margin-top: 8px; }
  .pill { display: inline-block; flex: none; padding: 0 7px; border-radius: 99px; background: var(--wash); color: var(--muted); font-size: 11px; line-height: 18px; }
  .pill.tone { color: var(--fg); background: color-mix(in srgb, var(--tone) 16%, transparent); }
  .verified { background: color-mix(in srgb, var(--good) 15%, transparent); color: var(--good); }
  .self_claimed, .shared { background: color-mix(in srgb, var(--warn) 15%, transparent); color: var(--warn); }
  a { color: inherit; }
  .links a { color: var(--muted); }
  .links a:hover { color: var(--fg); }
  button { all: unset; box-sizing: border-box; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; min-height: 30px; padding: 0 10px; border: 1px solid var(--line); border-radius: 6px; font-size: 12px; font-weight: 500; color: var(--fg); background: var(--bg); }
  button:hover { background: var(--wash); }
  button:disabled { opacity: .5; cursor: default; }
  button.primary { background: var(--accent); border-color: var(--accent); color: var(--accent-fg); }
  button.x, button.ghost { border-color: transparent; background: transparent; color: var(--muted); }
  button.x { min-height: 22px; padding: 0 5px; }
  button.ghost { min-height: 22px; padding: 0 4px; }
  button.ghost:hover, button.x:hover { color: var(--fg); background: var(--wash); }
  :focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
  .actions { display: flex; gap: 6px; margin-top: 12px; }
  .actions > button:not(.more) { flex: 1; }
  .menu { position: relative; }
  .menu [role=menu] { position: absolute; right: 0; bottom: calc(100% + 4px); min-width: 120px; padding: 4px; border: 1px solid var(--line); border-radius: 8px; background: var(--bg); box-shadow: 0 6px 20px rgb(0 0 0 / .14); }
  .menu [role=menu] button { display: flex; width: 100%; justify-content: flex-start; border: 0; }
  [hidden] { display: none !important; }
  .ok { color: var(--good); font-weight: 500; }
  .warn-text { color: var(--bad); }
  .menu [role=menu] button.danger { color: var(--bad); }
  ${TAG_FORM_CSS}
`;

const TONE: Record<string, string> = { mine: "var(--accent)", trusted: "var(--good)", watchlist: "var(--warn)", scam: "var(--bad)" };

let current: { host: HTMLElement; cleanup: () => void } | null = null;

export function closeCard() {
  current?.cleanup();
  current?.host.remove();
  current = null;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, unknown> = {}, ...children: (Node | string | null | undefined)[]): HTMLElementTagNameMap[K] {
  const e = Object.assign(document.createElement(tag), props) as HTMLElementTagNameMap[K];
  e.append(...children.filter((c): c is Node | string => c != null));
  return e;
}

function position(host: HTMLElement, anchor: DOMRect, card: HTMLElement) {
  const r = card.getBoundingClientRect();
  const below = anchor.bottom + 6 + r.height < innerHeight;
  host.style.top = `${Math.max(8, below ? anchor.bottom + 6 : anchor.top - r.height - 6)}px`;
  host.style.left = `${Math.max(8, Math.min(anchor.left, innerWidth - r.width - 8))}px`;
}

function brandRow(onClose: () => void) {
  const close = el("button", { className: "x", type: "button", textContent: "✕", ariaLabel: "Close" });
  close.addEventListener("click", onClose);
  return el("div", { className: "brand" }, el("span", { textContent: "TagAWallet" }), close);
}

const profilePath = (top: ResolvedLabel) => top.entity?.slug ? `/p/${top.entity.slug}` : top.walletId ? `/dashboard?w=${top.walletId}` : top.entity ? `/entities/${top.entity.id}` : "/dashboard";

function details(root: HTMLElement, found: DetectedAddress, labels: ResolvedLabel[], onEdit: () => void, onRemove: () => void, onClose: () => void) {
  const top = labels[0]!;
  const copy = el("button", { className: "ghost", textContent: "Copy", ariaLabel: "Copy address" });
  copy.addEventListener("click", async () => {
    await navigator.clipboard.writeText(found.raw); // Only ever on this explicit click.
    copy.textContent = "Copied";
  });
  // An account with no wallet has no address to tag, so editing happens in the dashboard.
  const noWallet = (found.kind as string) === "x";
  const mine = labels.some((l) => l.source === "private");
  const edit = el("button", { className: "primary", textContent: noWallet ? "Edit" : mine ? "Edit tag" : "Add my tag" });
  edit.addEventListener("click", () => {
    if (noWallet) void send({ type: "open", path: top.entity ? `/entities/${top.entity.id}` : "/dashboard" });
    else onEdit();
  });
  const open = el("button", { textContent: "Open" });
  open.setAttribute("aria-label", "Open in TagAWallet");
  open.addEventListener("click", () => void send({ type: "open", path: profilePath(top) }));

  // Reporting only makes sense for labels other people published. Removing only for your own.
  const isPublic = top.source === "verified" || top.source === "self_claimed";
  const items = el("div", { role: "menu", hidden: true });
  const toggle = el("button", { className: "more", textContent: "⋯", ariaLabel: "More actions", ariaHasPopup: "menu", ariaExpanded: "false" });
  const closeMenu = () => { items.hidden = true; toggle.setAttribute("aria-expanded", "false"); };
  toggle.addEventListener("click", () => { items.hidden = !items.hidden; toggle.setAttribute("aria-expanded", String(!items.hidden)); });
  const copyLabel = el("button", { role: "menuitem", textContent: "Copy label" });
  copyLabel.addEventListener("click", async () => {
    await navigator.clipboard.writeText(top.label);
    copyLabel.textContent = "Copied";
    setTimeout(() => { copyLabel.textContent = "Copy label"; closeMenu(); }, 900);
  });
  items.append(copyLabel);
  if (mine && !noWallet) {
    const remove = el("button", { role: "menuitem", className: "danger", textContent: "Remove my tag" });
    remove.addEventListener("click", () => onRemove());
    items.append(remove);
  }
  if (isPublic) {
    const report = el("button", { role: "menuitem", textContent: "Report this label" });
    // Straight to the report form for this wallet's claim, or for the whole profile when there's no link.
    report.addEventListener("click", () => void send({ type: "open", path: top.entity?.slug ? `/p/${top.entity.slug}?report=${top.linkId ?? "profile"}#report` : "/dashboard" }));
    items.append(report);
  }
  const menu = el("div", { className: "menu" }, toggle, items);

  const links = el("div", { className: "row sec links" });
  for (const l of top.links.slice(0, 6)) {
    const url = l.type === "ens" ? linkHref("ens", l.url) : sanitizeUrl(l.url);
    if (url) links.append(el("a", { href: url, target: "_blank", rel: "noopener noreferrer nofollow", textContent: l.label || LINK_TYPE_LABELS[l.type as LinkType] || "Link" }));
  }
  const badge = top.entity?.verification === "verified" || top.source === "verified" ? "✓ Verified" : SOURCE_WORD[top.source] ?? top.source;
  const status = top.status && top.status !== "none" ? el("span", { className: "pill tone", textContent: top.status }) : null;
  status?.style.setProperty("--tone", TONE[top.status!] ?? "var(--muted)");
  const chainName = CHAINS[top.chain as keyof typeof CHAINS]?.name ?? top.chain;
  const others = labels.length - 1;

  const parts: (Node | null)[] = [
    brandRow(onClose),
    el("div", { className: "row between" }, el("h2", { textContent: top.label }), el("span", { className: `pill ${top.source}`, textContent: badge, title: top.provenance })),
    el("div", { className: "row between", style: "margin-top:2px" }, el("span", { className: "addr", title: found.raw, textContent: `${truncateAddress(found.raw)} · ${chainName}` }), copy),
    top.entity ? el("div", { className: "sec" }, el("b", { textContent: top.entity.name }), el("span", { className: "muted", textContent: ` · ${top.entity.linkedWallets} wallet${top.entity.linkedWallets === 1 ? "" : "s"} linked` })) : null,
    status || top.tags.length ? el("div", { className: "row sec" }, status, ...top.tags.slice(0, 8).map((t) => el("span", { className: "pill", textContent: t }))) : null,
    top.notes ? el("div", { className: "sec", textContent: top.notes }) : null,
    top.links.length ? links : null,
    el("div", { className: "sec muted", textContent: top.provenance + (others > 0 ? ` · ${others} other label${others === 1 ? "" : "s"}` : ""), title: others > 0 ? labels.slice(1).map((l) => `${l.label} (${l.provenance})`).join("\n") : "" }),
    el("div", { className: "actions" }, edit, open, menu),
  ];
  root.append(...parts.filter((p): p is Node => p !== null));
}

function confirmRemove(root: HTMLElement, found: DetectedAddress, labels: ResolvedLabel[], onBack: () => void, onClose: () => void, onLayout: () => void) {
  const mine = labels.find((l) => l.source === "private")!;
  const error = el("p", { className: "muted warn-text", role: "alert" });
  const remove = el("button", { className: "primary", textContent: "Remove" });
  const cancel = el("button", { textContent: "Cancel" });
  cancel.addEventListener("click", onBack);
  remove.addEventListener("click", async () => {
    remove.disabled = true;
    const r = await send<UntagResult>({ type: "untag", address: found.raw, chain: mine.chain });
    if (!r.ok) { remove.disabled = false; error.textContent = r.error; onLayout(); return; }
    root.replaceChildren(el("p", { className: "ok", role: "status", textContent: r.queued ? "Removed. It will sync when you're back online." : "Removed." }));
    onLayout();
    setTimeout(onClose, 1200);
  });
  root.replaceChildren(
    brandRow(onClose),
    el("h2", { textContent: `Remove “${mine.label}”?` }),
    el("p", { className: "muted", textContent: `This deletes your tag for ${truncateAddress(found.raw)}, and takes it out of your lists. Other people's labels stay.` }),
    error,
    el("div", { className: "actions" }, remove, cancel),
  );
  onLayout();
  remove.focus();
}

/** The session ended: say so plainly, and offer the one fix. */
function reconnect(root: HTMLElement, onClose: () => void, expired: boolean) {
  const connect = el("button", { className: "primary", textContent: expired ? "Reconnect" : "Connect account" });
  connect.addEventListener("click", () => void send({ type: "open", path: `/extension/connect?ext=${chrome.runtime.id}` }));
  root.append(
    brandRow(onClose),
    el("h2", { textContent: expired ? "Your session expired" : "Connect to save tags" }),
    el("p", { className: "muted", textContent: expired ? "Sign in again to keep saving tags. Nothing you saved is lost." : "Tags are private to your account. Connect once and this browser stays signed in." }),
    connect,
  );
}

async function tagForm(root: HTMLElement, found: DetectedAddress, labels: ResolvedLabel[], host: string, onClose: () => void, onLayout: () => void) {
  root.replaceChildren(el("div", { className: "muted", textContent: "Loading…" }));
  const [boot, status] = await Promise.all([send<Bootstrap | null>({ type: "bootstrap" }), send<Status>({ type: "status" })]);
  root.replaceChildren();
  if (!status.connected) {
    reconnect(root, onClose, status.authState === "expired");
    onLayout();
    return;
  }
  const kind = found.kind === "solana" || found.kind === "bitcoin" ? found.kind : "evm";
  const form = buildTagForm({
    address: found.raw, kind, existing: labels.find((l) => l.source === "private") ?? null, boot, host, path: location.pathname + location.search,
    onCancel: onClose, onLayout,
    onDone: (message) => {
      root.replaceChildren(el("p", { className: "ok", role: "status", textContent: message }));
      onLayout();
      setTimeout(onClose, 1400);
    },
  });
  root.append(brandRow(onClose), form);
  onLayout();
}

/** Mounts the floating panel beside an anchor, with focus trapping and outside-click and Escape to close. */
function openPanel(anchor: HTMLElement, settings: Settings) {
  closeCard();
  const cardHost = document.createElement("tagawallet-card");
  cardHost.setAttribute("data-theme", appearance(settings, anchor));
  const shadow = cardHost.attachShadow({ mode: "open" });
  const root = el("div", { className: "card", role: "dialog", ariaLabel: "Wallet details", tabIndex: -1 });
  shadow.append(el("style", { textContent: CARD_CSS }), root);
  document.documentElement.append(cardHost);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") { closeCard(); anchor.shadowRoot?.querySelector("button")?.focus(); return; }
    if (e.key !== "Tab") return;
    const items = [...root.querySelectorAll<HTMLElement>("button,a,input:not([hidden]),select:not([hidden]),textarea")].filter((n) => !n.closest("[hidden]"));
    if (!items.length) return;
    const first = items[0]!, last = items[items.length - 1]!, activeEl = shadow.activeElement;
    if (e.shiftKey && (activeEl === first || activeEl === null)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && activeEl === last) { e.preventDefault(); first.focus(); }
  };
  const onDown = (e: MouseEvent) => { if (!e.composedPath().includes(cardHost)) closeCard(); };
  let fadeTimer: ReturnType<typeof setTimeout> | null = null;
  const onScroll = () => {
    if (!anchor.isConnected) { closeCard(); return; }
    root.style.opacity = "0.45";
    position(cardHost, anchor.getBoundingClientRect(), root);
    if (fadeTimer) clearTimeout(fadeTimer);
    fadeTimer = setTimeout(() => { root.style.opacity = "1"; }, 180);
  };
  document.addEventListener("keydown", onKey, true);
  document.addEventListener("mousedown", onDown, true);
  document.addEventListener("scroll", onScroll, true);
  window.addEventListener("resize", onScroll);
  current = {
    host: cardHost,
    cleanup: () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("mousedown", onDown, true);
      document.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
      if (fadeTimer) clearTimeout(fadeTimer);
    },
  };
  const reposition = () => position(cardHost, anchor.getBoundingClientRect(), root);
  return { root, reposition };
}

/** A short message in the same panel, for when there's nothing to tag. */
export function openNotice(anchor: HTMLElement, settings: Settings, title: string, text: string) {
  const { root, reposition } = openPanel(anchor, settings);
  const ok = el("button", { textContent: "OK" });
  ok.addEventListener("click", closeCard);
  root.append(brandRow(closeCard), el("h2", { textContent: title }), el("p", { className: "muted", textContent: text }), el("div", { className: "actions" }, ok));
  reposition();
  ok.focus();
}

export async function openCard(anchor: HTMLElement, found: DetectedAddress, labels: ResolvedLabel[], settings: Settings, host: string, opts: { edit?: boolean } = {}) {
  const { root, reposition } = openPanel(anchor, settings);
  const edit = async () => { await tagForm(root, found, labels, host, closeCard, reposition); };
  const show = () => {
    root.replaceChildren();
    details(root, found, labels, () => void edit(), () => confirmRemove(root, found, labels, show, closeCard, reposition), closeCard);
    reposition();
    root.querySelector<HTMLElement>("button:not(.x)")?.focus();
  };
  if (labels.length && !opts.edit) {
    show();
    // Labels may come from cache. An ended session still gets said, so saving doesn't fail by surprise.
    const status = await send<Status>({ type: "status" });
    if (status.authState === "expired" && root.isConnected) {
      const link = el("button", { className: "ghost", textContent: "Reconnect" });
      link.addEventListener("click", () => void send({ type: "open", path: `/extension/connect?ext=${chrome.runtime.id}` }));
      root.querySelector(".brand")?.after(el("div", { className: "row between sec muted warn-text", role: "status" }, el("span", { textContent: "Session expired." }), link));
      reposition();
    }
  }
  else {
    reposition();
    await edit();
  }
}
