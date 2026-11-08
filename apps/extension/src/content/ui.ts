import { CHAINS, LINK_TYPE_LABELS, linkHref, sanitizeUrl, truncateAddress, type DetectedAddress, type LinkType } from "@tagawallet/shared/lite";
import { send, type ResolvedLabel, type Route, type Settings, type Status, type UntagResult } from "../lib/messages";
import { MARK_PARTS } from "../lib/brand-mark-paths";
import { linkText } from "../lib/links";
import { routeTo } from "./float";

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
  /* Rail: a thin colour strip, for dense tables. The name appears on hover and focus. */
  .rail { position: relative; width: 4px; height: 14px; padding: 0; border: 0; border-radius: 2px; background: var(--muted); vertical-align: middle; }
  .rail.private, .rail.shared { background: var(--accent); }
  .rail.verified { background: var(--good); }
  .rail.self_claimed { background: var(--warn); }
  .rail.flagged { background: var(--bad); }
  .rail.unknown { width: 6px; background: transparent; border: 1px dashed var(--muted); }
  .rail:hover::after, .rail:focus-visible::after { content: attr(data-tip); position: absolute; left: 50%; bottom: calc(100% + 6px); transform: translateX(-50%); z-index: 2; padding: 3px 7px; border-radius: 5px; background: var(--fg); color: var(--bg); font: 500 11px/16px ui-sans-serif, system-ui, sans-serif; white-space: nowrap; pointer-events: none; }
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

const SOURCE_WORD: Record<string, string> = { private: "Your tag", shared: "Shared list", verified: "Verified", self_claimed: "Public", community: "Public" };
const ROLE_WORD: Record<string, string> = { owner: "owner", treasury: "treasury", hot_wallet: "hot wallet", cold_wallet: "cold wallet", associated: "associated", custom: "custom" };

/** Chip and card title: the person or project when linked, otherwise the private wallet name. */
function displayName(top: ResolvedLabel) {
  return top.entity?.name || top.label;
}
function roleWord(top: ResolvedLabel) {
  const r = top.entity?.relationship;
  return r && r !== "associated" ? ROLE_WORD[r] ?? r.replace(/_/g, " ") : "";
}

function chipParts(labels: ResolvedLabel[]) {
  const top = labels[0];
  if (!top) return { cls: "unknown", text: "", mark: true, title: "Not tagged yet. Click to tag it.", aria: "Tag this wallet" };
  const name = displayName(top);
  const role = roleWord(top);
  // Verified gets a check. Every other source is told apart by color, and spelled out in the tooltip.
  const text = (top.source === "verified" ? "✓ " : "") + name;
  const word = SOURCE_WORD[top.source] ?? top.provenance;
  const title = [name, role, word].filter(Boolean).join(" · ");
  return { cls: top.source, text, mark: false, title, aria: `TagAWallet: ${title}. ${top.provenance}` };
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
  const rail = s.chipStyle === "rail";
  const flagged = labels.some((l) => l.status === "watchlist" || l.status === "scam");
  h.button.className = [p.cls, minimal && "minimal", rail && "rail", rail && flagged && "flagged"].filter(Boolean).join(" ");
  h.button.title = p.title;
  h.button.setAttribute("data-tip", p.title);
  h.button.setAttribute("aria-label", p.aria);
  if (rail) {
    h.button.replaceChildren();
    return;
  }
  const label = document.createElement("span");
  label.className = "t";
  label.textContent = minimal ? p.text.replace(/^✓\s/, "") : p.text;
  h.button.replaceChildren(p.mark ? tagMark() : label);
}

// ---- Card ----
// A glance at who's behind an address, right where it is on the page. Anything more (tagging, details,
// the wallet's contact or list) opens in the TagAWallet panel, so the card stays small and quick.

const CARD_CSS = `
  :host { all: initial; position: fixed; z-index: 2147483647; inset: auto; color-scheme: light;
    --raised:#ffffff; --card:#fffefb; --ink:#1a1a18; --muted:#6a675e; --line:#dfdbcf; --wash:#efece2; --edge:rgb(26 26 24 / .10);
    --accent:#c8421b; --accent-ink:#fff; --good:#1b7a4a; --warn:#9a6a00; --bad:#b3261e; }
  :host([data-theme=dark]) { color-scheme: dark;
    --raised:#2a2924; --card:#1c1c19; --ink:#efece3; --muted:#9c988b; --line:#3a3933; --wash:#33322c; --edge:rgb(239 236 227 / .12);
    --accent:#ee6a42; --accent-ink:#1a0d07; --good:#55c58d; --warn:#dbab45; --bad:#f2837b; }
  * { box-sizing: border-box; font-family: "Instrument Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
  .card:focus { outline: none; }
  .card { width: 320px; max-width: calc(100vw - 16px); max-height: min(560px, calc(100vh - 16px)); overflow: auto; padding: 12px 14px 14px;
    border-radius: 16px; background: var(--raised); color: var(--ink); font-size: 13px; line-height: 1.45; -webkit-font-smoothing: antialiased;
    box-shadow: 0 0 0 1px var(--edge), inset 0 1px 0 rgb(255 255 255 / .06), 0 24px 64px -16px rgb(0 0 0 / .45), 0 8px 20px -8px rgb(0 0 0 / .25);
    transition: opacity 150ms ease; animation: in 160ms cubic-bezier(.2,.8,.2,1); }
  @keyframes in { from { opacity: 0; transform: translateY(4px) scale(.985); } }
  @media (prefers-reduced-motion: reduce) { .card { animation: none; } }
  [hidden] { display: none !important; }
  :focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 6px; }

  .brand { display: flex; align-items: center; gap: 6px; margin: -2px -6px 8px 0; font-size: 11px; font-weight: 600; color: var(--muted); letter-spacing: .01em; }
  .brand .grow { flex: 1; }
  .who { display: flex; align-items: center; gap: 10px; }
  .avatar { display: grid; place-items: center; width: 36px; height: 36px; flex: none; border-radius: 99px; background: var(--wash); color: var(--muted); font-size: 12px; font-weight: 600; }
  .avatar.verified { box-shadow: 0 0 0 2px var(--raised), 0 0 0 3.5px var(--good); }
  .avatar.flagged { background: color-mix(in srgb, var(--bad) 14%, transparent); color: var(--bad); }
  .who .text { flex: 1; min-width: 0; }
  h2 { margin: 0; font-size: 16px; font-weight: 600; letter-spacing: -.01em; line-height: 1.3; white-space: nowrap; overflow: hidden; }
  h2.over { mask-image: linear-gradient(to right, #000 calc(100% - 1.25rem), transparent); }
  .sub { margin-top: 1px; color: var(--muted); font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pill { display: inline-flex; align-items: center; gap: 4px; flex: none; padding: 1px 8px; border-radius: 99px; background: var(--wash); color: var(--muted); font-size: 11px; font-weight: 500; line-height: 18px; white-space: nowrap; }
  .pill .tone { width: 6px; height: 6px; border-radius: 99px; background: var(--tone, var(--muted)); }
  .pill.good { background: color-mix(in srgb, var(--good) 15%, transparent); color: var(--good); }
  .pill.warn { background: color-mix(in srgb, var(--warn) 15%, transparent); color: var(--warn); }
  .pill.accent { background: color-mix(in srgb, var(--accent) 14%, transparent); color: var(--accent); }
  .pill.bad { background: color-mix(in srgb, var(--bad) 14%, transparent); color: var(--bad); }

  .addr { display: flex; align-items: center; gap: 6px; margin-top: 12px; padding: 4px 4px 4px 10px; border-radius: 10px; background: var(--wash); }
  .addr .mono { flex: 1; min-width: 0; font-family: ui-monospace, "JetBrains Mono", SFMono-Regular, Menlo, monospace; font-size: 12px; letter-spacing: -.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .addr .chain { color: var(--muted); }
  .chips { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 10px; }
  .note { margin: 10px 0 0; color: var(--muted); font-size: 12px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere; }
  .links { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 10px; }
  .links a { display: inline-flex; align-items: center; gap: 4px; padding: 2px 9px; border-radius: 99px; background: var(--card); box-shadow: inset 0 0 0 1px var(--line); color: var(--ink); font-size: 11px; font-weight: 500; text-decoration: none; }
  .links a:hover { background: var(--wash); }
  .prov { margin-top: 10px; color: var(--muted); font-size: 11px; }
  .warn-row { display: flex; align-items: center; gap: 8px; margin: 0 0 10px; padding: 6px 6px 6px 10px; border-radius: 10px; background: color-mix(in srgb, var(--bad) 10%, transparent); color: var(--bad); font-size: 12px; }
  .warn-row span { flex: 1; }

  button { all: unset; box-sizing: border-box; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 34px; padding: 0 12px;
    border-radius: 9px; font-size: 13px; font-weight: 500; color: var(--ink); background: var(--card); box-shadow: inset 0 0 0 1px var(--line);
    transition: transform 150ms ease-out, background-color 150ms ease-out, color 150ms ease-out; }
  button:hover { background: var(--wash); }
  button:active:not(:disabled) { transform: scale(.96); }
  button:disabled { opacity: .5; cursor: default; }
  button.primary { background: var(--accent); box-shadow: none; color: var(--accent-ink); }
  button.primary:hover { background: var(--accent); opacity: .92; }
  button.danger { background: var(--bad); box-shadow: none; color: var(--raised); }
  button.icon { width: 28px; min-height: 28px; padding: 0; border-radius: 8px; background: transparent; box-shadow: none; color: var(--muted); }
  button.icon:hover { background: color-mix(in srgb, var(--ink) 7%, transparent); color: var(--ink); }
  .actions { display: flex; gap: 6px; margin-top: 14px; }
  .actions > button:not(.more) { flex: 1; }
  .actions .more { width: 34px; padding: 0; }
  .menu { position: relative; }
  .menu [role=menu] { position: absolute; right: 0; bottom: calc(100% + 6px); min-width: 180px; padding: 4px; border-radius: 12px; background: var(--raised);
    box-shadow: 0 0 0 1px var(--edge), 0 16px 40px -12px rgb(0 0 0 / .4); }
  .menu [role=menu] button { display: flex; width: 100%; min-height: 32px; justify-content: flex-start; padding: 0 10px; border-radius: 8px; background: transparent; box-shadow: none; font-size: 13px; }
  .menu [role=menu] button:hover { background: var(--wash); }
  .menu [role=menu] .sep { height: 1px; margin: 4px 6px; background: var(--line); }
  .menu [role=menu] button.danger { color: var(--bad); background: transparent; }
  .menu [role=menu] button.danger:hover { background: color-mix(in srgb, var(--bad) 10%, transparent); }
  p.muted { margin: 6px 0 0; color: var(--muted); font-size: 12px; }
  .ok { margin: 0; color: var(--good); font-weight: 500; }
  .err { margin: 8px 0 0; color: var(--bad); font-size: 12px; }
  .err:empty { display: none; }
`;

const TONE: Record<string, string> = { mine: "var(--accent)", trusted: "var(--good)", watchlist: "var(--warn)", scam: "var(--bad)" };
const STATUS_WORD: Record<string, string> = { mine: "Mine", trusted: "Trusted", watchlist: "Watchlist", scam: "Scam" };
const PROVENANCE: Record<string, { word: string; tone: string }> = {
  private: { word: "Your tag", tone: "" }, shared: { word: "Shared list", tone: "warn" }, verified: { word: "✓ Verified", tone: "good" },
  official: { word: "✓ Official", tone: "good" }, self_claimed: { word: "Public", tone: "accent" }, community: { word: "Public", tone: "accent" },
};

let current: { host: HTMLElement; cleanup: () => void } | null = null;

export function closeCard() {
  current?.cleanup();
  current?.host.remove();
  current = null;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, unknown> = {}, ...children: (Node | string | null | undefined | false)[]): HTMLElementTagNameMap[K] {
  const e = Object.assign(document.createElement(tag), props) as HTMLElementTagNameMap[K];
  e.append(...children.filter((c): c is Node | string => !!c));
  return e;
}

const SVG = "http://www.w3.org/2000/svg";
/** The same 1.5px outline icons as the panel and dashboard. */
function icon(d: string, size = 14) {
  const svg = document.createElementNS(SVG, "svg");
  for (const [k, v] of Object.entries({ viewBox: "0 0 16 16", width: String(size), height: String(size), fill: "none", stroke: "currentColor", "stroke-width": "1.5", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" })) svg.setAttribute(k, v);
  for (const part of d.split("|")) { const p = document.createElementNS(SVG, "path"); p.setAttribute("d", part); svg.append(p); }
  return svg;
}
const ICONS = {
  x: "m4.5 4.5 7 7m0-7-7 7",
  copy: "M7 5.5h4A1.5 1.5 0 0 1 12.5 7v4a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 11V7A1.5 1.5 0 0 1 7 5.5Z|M10.5 5.5v-1A1.5 1.5 0 0 0 9 3H4.5A1.5 1.5 0 0 0 3 4.5V9a1.5 1.5 0 0 0 1.5 1.5h1",
  check: "m3.5 8.5 3 3 6-7",
  tag: "M2.75 3.5a.75.75 0 0 1 .75-.75h4.1l5.65 5.65a.75.75 0 0 1 0 1.06l-3.6 3.6a.75.75 0 0 1-1.06 0L2.94 7.41a.75.75 0 0 1-.19-.5Z",
  details: "M3 3.5h10v9H3z|M5.5 6.5h5M5.5 9h3",
  more: "M4 8h.01M8 8h.01M12 8h.01",
  external: "M6.5 3.5h-2a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1v-2|M9 3.5h3.5V7|M12.5 3.5 7.5 8.5",
};

const MARK_FILL = { brand: "#EE6A42", white: "#fff", ink: "currentColor" };
function brandMark() {
  const svg = document.createElementNS(SVG, "svg");
  for (const [k, v] of Object.entries({ viewBox: "0 0 515 415", width: "17", height: String((17 * 415) / 515), fill: "none", "aria-hidden": "true" })) svg.setAttribute(k, v);
  for (const p of MARK_PARTS) {
    const path = document.createElementNS(SVG, "path");
    path.setAttribute("d", p.d);
    path.setAttribute("fill", MARK_FILL[p.tone]);
    if (p.evenodd) { path.setAttribute("fill-rule", "evenodd"); path.setAttribute("clip-rule", "evenodd"); }
    svg.append(path);
  }
  return svg;
}

function position(host: HTMLElement, anchor: DOMRect, card: HTMLElement) {
  const r = card.getBoundingClientRect();
  const below = anchor.bottom + 8 + r.height < innerHeight;
  host.style.top = `${Math.max(8, below ? anchor.bottom + 8 : anchor.top - r.height - 8)}px`;
  host.style.left = `${Math.max(8, Math.min(anchor.left - 4, innerWidth - r.width - 8))}px`;
}

function brandRow(onClose: () => void) {
  const close = el("button", { className: "icon", type: "button", ariaLabel: "Close" }, icon(ICONS.x));
  close.addEventListener("click", onClose);
  return el("div", { className: "brand" }, brandMark(), el("span", { className: "grow", textContent: "TagAWallet" }), close);
}

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";
export const kindOf = (found: DetectedAddress): "evm" | "solana" | "bitcoin" => (found.kind === "solana" || found.kind === "bitcoin" ? found.kind : "evm");

/** The wallet at a glance: who, where it's filed, its labels. Tagging and details open in the panel. */
function details(root: HTMLElement, found: DetectedAddress, labels: ResolvedLabel[], onRemove: () => void, onClose: () => void, onLayout: () => void) {
  const top = labels[0];
  const noAddress = (found.kind as string) === "x";
  // A page action: show it in the panel, where the person keeps it (floating or side), and close the card.
  const show = (route: Route) => { closeCard(); void routeTo(route); };
  const kind = kindOf(found);

  if (!top) {
    // Nothing known yet. The panel is where tagging happens.
    const tag = el("button", { className: "primary", type: "button" }, icon(ICONS.tag), "Tag this wallet");
    tag.addEventListener("click", () => show({ view: "tag", address: found.raw, kind }));
    root.append(brandRow(onClose), el("h2", { textContent: "Not tagged yet" }), addressRow(found, null), el("div", { className: "actions" }, tag));
    return;
  }

  const name = displayName(top);
  const role = roleWord(top);
  const own = top.entity && top.label && top.label !== top.entity.name ? top.label : "";
  const mine = labels.some((l) => l.source === "private");
  const verified = top.source === "verified" || top.source === "official" || top.entity?.verification === "verified";
  const flagged = top.status === "watchlist" || top.status === "scam";
  const prov = PROVENANCE[top.source] ?? { word: top.source, tone: "" };
  const isPublic = ["verified", "official", "self_claimed", "community"].includes(top.source);

  const avatar = el("span", { className: `avatar${verified ? " verified" : ""}${flagged ? " flagged" : ""}`, textContent: initials(name), ariaHidden: "true" });
  const title = el("h2", { textContent: name, title: name });
  // "Hot wallet · Hot wallet" says nothing twice: the role and your own name for it are shown once when they match.
  const roleText = role && role[0]!.toUpperCase() + role.slice(1);
  const subParts = [roleText, own && own.toLowerCase() !== role.toLowerCase() ? own : "", top.listName && `in ${top.listName}`].filter(Boolean);
  const who = el("div", { className: "who" }, avatar, el("div", { className: "text" }, title, subParts.length ? el("div", { className: "sub", textContent: subParts.join(" · ") }) : null),
    el("span", { className: `pill ${verified ? "good" : prov.tone}`, textContent: verified ? "✓ Verified" : prov.word, title: top.provenance }));

  const chips = el("div", { className: "chips" });
  if (top.status && top.status !== "none") {
    const s = el("span", { className: "pill" }, el("span", { className: "tone" }), STATUS_WORD[top.status] ?? top.status);
    s.style.setProperty("--tone", TONE[top.status] ?? "var(--muted)");
    chips.append(s);
  }
  for (const t of top.tags.slice(0, 6)) chips.append(el("span", { className: "pill", textContent: t }));
  if (top.tags.length > 6) chips.append(el("span", { className: "pill", textContent: `+${top.tags.length - 6}` }));

  const links = el("div", { className: "links" });
  for (const l of top.links.slice(0, 5)) {
    const url = l.type === "ens" ? linkHref("ens", l.url) : sanitizeUrl(l.url);
    if (url) links.append(el("a", { href: url, target: "_blank", rel: "noopener noreferrer nofollow", textContent: linkText(l, url) }));
  }

  // Your own words come first. For a name with no address (an X account), the contact is what opens.
  const entityRoute: Route | null = top.entity ? { view: "collection", kind: "entity", id: top.entity.id, name: top.entity.name } : null;
  const edit = el("button", { className: "primary", type: "button" }, icon(ICONS.tag), noAddress ? "Open contact" : mine ? "Edit tag" : "Add my tag");
  edit.addEventListener("click", () => {
    if (noAddress) { if (entityRoute) show(entityRoute); else void send({ type: "open", path: "/dashboard" }); }
    else show({ view: "tag", address: found.raw, kind });
  });
  const more = noAddress ? null : el("button", { type: "button", ariaLabel: "Details in TagAWallet" }, icon(ICONS.details), "Details");
  more?.addEventListener("click", () => show({ view: "wallet", address: found.raw, kind }));

  const items = el("div", { role: "menu", hidden: true });
  const toggle = el("button", { className: "more", type: "button", ariaLabel: "More actions", ariaHasPopup: "menu", ariaExpanded: "false" }, icon(ICONS.more, 16));
  const closeMenu = () => { items.hidden = true; toggle.setAttribute("aria-expanded", "false"); };
  toggle.addEventListener("click", () => { items.hidden = !items.hidden; toggle.setAttribute("aria-expanded", String(!items.hidden)); onLayout(); });
  const item = (text: string, fn: () => void, cls = "") => { const b = el("button", { role: "menuitem", type: "button", textContent: text, className: cls }); b.addEventListener("click", fn); items.append(b); return b; };
  const copyLabel = item("Copy label", async () => { await navigator.clipboard.writeText(name); copyLabel.textContent = "Copied"; setTimeout(() => { copyLabel.textContent = "Copy label"; closeMenu(); }, 900); });
  if (entityRoute && !noAddress) item(`Open ${top.entity!.name}`, () => show(entityRoute));
  item("Open in dashboard", () => void send({ type: "open", path: top.entity ? `/entities/${top.entity.id}` : top.walletId ? `/wallets?w=${top.walletId}` : "/dashboard" }));
  if (top.entity?.slug) item("View public page", () => void send({ type: "open", path: `/p/${top.entity!.slug}` }));
  if (isPublic) item("Report this label", () => void send({ type: "open", path: top.entity?.slug ? `/p/${top.entity.slug}?report=${top.linkId ?? "profile"}#report` : "/dashboard" }));
  if (mine && !noAddress) { items.append(el("div", { className: "sep" })); item("Remove my tag", onRemove, "danger"); }

  const others = labels.length - 1;
  root.append(...([
    brandRow(onClose),
    who,
    noAddress ? null : addressRow(found, top.chain),
    chips.childElementCount ? chips : null,
    top.notes ? el("p", { className: "note", textContent: top.notes, title: top.notes }) : null,
    links.childElementCount ? links : null,
    el("div", { className: "prov", textContent: top.provenance + (others > 0 ? ` · ${others} other label${others === 1 ? "" : "s"}` : ""), title: others > 0 ? labels.slice(1).map((l) => `${displayName(l)} (${l.provenance})`).join("\n") : "" }),
    el("div", { className: "actions" }, edit, more, el("div", { className: "menu" }, toggle, items)),
  ] as (HTMLElement | null)[]).filter((p): p is HTMLElement => !!p));
  // A long name fades at the end rather than being cut with "…", and only when it doesn't fit.
  requestAnimationFrame(() => title.classList.toggle("over", title.scrollWidth > title.clientWidth + 1));
}


function addressRow(found: DetectedAddress, chain: string | null) {
  const copy = el("button", { className: "icon", type: "button", ariaLabel: "Copy address", title: "Copy address" }, icon(ICONS.copy));
  copy.addEventListener("click", async () => {
    await navigator.clipboard.writeText(found.raw); // Only ever on this explicit click.
    copy.replaceChildren(icon(ICONS.check));
    copy.setAttribute("aria-label", "Copied");
    setTimeout(() => { copy.replaceChildren(icon(ICONS.copy)); copy.setAttribute("aria-label", "Copy address"); }, 1400);
  });
  const chainName = chain ? CHAINS[chain as keyof typeof CHAINS]?.name ?? chain : "";
  return el("div", { className: "addr" },
    el("span", { className: "mono", title: found.raw }, truncateAddress(found.raw), chainName ? el("span", { className: "chain", textContent: ` · ${chainName}` }) : null),
    copy);
}

function confirmRemove(root: HTMLElement, found: DetectedAddress, labels: ResolvedLabel[], onBack: () => void, onClose: () => void, onLayout: () => void) {
  const mine = labels.find((l) => l.source === "private")!;
  const error = el("p", { className: "err", role: "alert" });
  const remove = el("button", { className: "danger", type: "button", textContent: "Remove" });
  const cancel = el("button", { type: "button", textContent: "Keep it" });
  cancel.addEventListener("click", onBack);
  remove.addEventListener("click", async () => {
    remove.disabled = true;
    const r = await send<UntagResult>({ type: "untag", address: found.raw, chain: mine.chain });
    if (!r.ok) { remove.disabled = false; error.textContent = r.error; onLayout(); return; }
    root.replaceChildren(brandRow(onClose), el("p", { className: "ok", role: "status", textContent: r.queued ? "Removed. It will sync when you're back online." : "Removed." }));
    onLayout();
    setTimeout(onClose, 1200);
  });
  root.replaceChildren(
    brandRow(onClose),
    el("h2", { textContent: `Remove “${mine.label}”?` }),
    el("p", { className: "muted", textContent: `This deletes your tag for ${truncateAddress(found.raw)} and takes it out of your lists. Other people's labels stay.` }),
    error,
    el("div", { className: "actions" }, remove, cancel),
  );
  onLayout();
  remove.focus();
}

/** Mounts the card beside an anchor, with focus trapping, and outside click and Escape to close. */
function mountCard(anchor: HTMLElement, settings: Settings) {
  closeCard();
  const cardHost = document.createElement("tagawallet-card");
  cardHost.setAttribute("data-theme", appearance(settings, anchor));
  const shadow = cardHost.attachShadow({ mode: "open" });
  const root = el("div", { className: "card", role: "dialog", ariaLabel: "Wallet details", tabIndex: -1 });
  shadow.append(el("style", { textContent: CARD_CSS }), root);
  document.documentElement.append(cardHost);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); closeCard(); anchor.shadowRoot?.querySelector("button")?.focus(); return; }
    if (e.key !== "Tab") return;
    const items = [...root.querySelectorAll<HTMLElement>("button,a")].filter((n) => !n.closest("[hidden]"));
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

/** A short message in the same card, for when there's nothing to tag. */
export function openNotice(anchor: HTMLElement, settings: Settings, title: string, text: string) {
  const { root, reposition } = mountCard(anchor, settings);
  const ok = el("button", { type: "button", textContent: "OK" });
  ok.addEventListener("click", closeCard);
  root.append(brandRow(closeCard), el("h2", { textContent: title }), el("p", { className: "muted", textContent: text }), el("div", { className: "actions" }, ok));
  reposition();
  ok.focus();
}

export async function openCard(anchor: HTMLElement, found: DetectedAddress, labels: ResolvedLabel[], settings: Settings) {
  const { root, reposition } = mountCard(anchor, settings);
  const show = () => {
    root.replaceChildren();
    details(root, found, labels, () => confirmRemove(root, found, labels, show, closeCard, reposition), closeCard, reposition);
    reposition();
    // Focus the card, not a button: opened with a mouse, a ring on "Edit tag" would read as a selection. Tab goes to the actions.
    root.focus({ preventScroll: true });
  };
  show();
  // Labels may come from cache. An ended session still gets said, so saving doesn't fail by surprise.
  const status = await send<Status>({ type: "status" });
  if (status.authState === "expired" && root.isConnected) {
    const link = el("button", { className: "icon", type: "button", textContent: "Reconnect", style: "width:auto;padding:0 8px;color:inherit" });
    link.addEventListener("click", () => void send({ type: "open", path: `/extension/connect?ext=${chrome.runtime.id}` }));
    root.querySelector(".brand")?.after(el("div", { className: "warn-row", role: "status" }, el("span", { textContent: "Your session expired." }), link));
    reposition();
  }
}
