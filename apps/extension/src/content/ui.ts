import { CHAIN_IDS, CHAINS, LINK_TYPE_LABELS, linkHref, sanitizeUrl, truncateAddress, type DetectedAddress, type LinkType } from "@tagawallet/shared/lite";
import { chainFromHost, send, type Bootstrap, type ResolvedLabel, type Settings, type TagResult } from "../lib/messages";

export const CHIP_TAG = "tagawallet-chip";
export interface ChipHandle { host: HTMLElement; found: DetectedAddress; button: HTMLButtonElement }

const THEME = `
  :host { all: initial; --bg:#fffefb; --fg:#1a1a18; --muted:#6a675e; --line:#dfdbcf; --wash:#efece2; --accent:#c8421b; --accent-fg:#fff; --good:#1b7a4a; --warn:#9a6a00; --bad:#b3261e; }
  :host([data-theme=dark]) { --bg:#1c1c19; --fg:#efece3; --muted:#9c988b; --line:#33322c; --wash:#25241f; --accent:#ee6a42; --accent-fg:#1a0d07; --good:#55c58d; --warn:#dbab45; --bad:#f2837b; }
  @media (prefers-color-scheme: dark) {
    :host([data-theme=system]) { --bg:#1c1c19; --fg:#efece3; --muted:#9c988b; --line:#33322c; --wash:#25241f; --accent:#ee6a42; --accent-fg:#1a0d07; --good:#55c58d; --warn:#dbab45; --bad:#f2837b; }
  }
  * { box-sizing: border-box; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
`;

const CHIP_CSS = `${THEME}
  :host { display: inline; vertical-align: baseline; margin-left: 4px; }
  :host([hidden]) { display: none; }
  button { all: unset; box-sizing: border-box; display: inline-flex; align-items: center; gap: 4px; max-width: 200px; padding: 0 5px; line-height: 16px; height: 18px; border-radius: 4px; font: 500 11px/16px ui-sans-serif, system-ui, sans-serif; cursor: pointer; border: 1px solid var(--line); background: var(--bg); color: var(--fg); vertical-align: middle; white-space: nowrap; }
  button:hover { background: var(--wash); }
  button:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
  .t { overflow: hidden; text-overflow: ellipsis; }
  .unknown { color: var(--muted); border-style: dashed; font-weight: 400; }
  .verified { border-color: var(--good); color: var(--good); }
  .self_claimed { border-color: var(--warn); color: var(--warn); }
  .shared { border-color: var(--warn); }
  .minimal { border-color: transparent; background: transparent; padding: 0 2px; }
  .minimal.unknown { opacity: .6; }
`;

function chipParts(labels: ResolvedLabel[]) {
  const top = labels[0];
  if (!top) return { cls: "unknown", text: "Tag this wallet", minimal: "+", title: "Not tagged yet. Click to tag this wallet." };
  const mark = top.source === "verified" ? "✓ " : top.source === "self_claimed" ? "◇ " : top.source === "shared" ? "⇄ " : "";
  return { cls: top.source, text: mark + top.label, minimal: mark + top.label, title: `${top.label} (${top.provenance})` };
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
  h.host.hidden = s.chipStyle === "hidden" || (isName && !labels.length);
  h.host.setAttribute("data-theme", s.theme);
  const p = chipParts(labels);
  const minimal = s.chipStyle === "minimal";
  h.button.className = `${p.cls}${minimal ? " minimal" : ""}`;
  h.button.title = p.title;
  h.button.setAttribute("aria-label", `TagAWallet: ${p.title}`);
  h.button.replaceChildren(Object.assign(document.createElement("span"), { className: "t", textContent: minimal ? p.minimal : p.text }));
}

// ---- Card ----

const CARD_CSS = `${THEME}
  :host { position: fixed; z-index: 2147483647; inset: auto; }
  .card { width: 320px; max-width: calc(100vw - 16px); max-height: min(520px, calc(100vh - 16px)); overflow: auto; background: var(--bg); color: var(--fg); border: 1px solid var(--line); border-radius: 10px; box-shadow: 0 8px 28px rgb(0 0 0 / .22); padding: 12px; font-size: 13px; line-height: 1.4; }
  h2 { margin: 0; font-size: 15px; font-weight: 600; overflow-wrap: anywhere; }
  .row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .between { justify-content: space-between; flex-wrap: nowrap; }
  .addr { font-family: ui-monospace, Menlo, monospace; font-size: 12px; color: var(--muted); }
  .muted { color: var(--muted); font-size: 12px; }
  .sec { margin-top: 8px; }
  .pill { display: inline-block; padding: 0 6px; border-radius: 99px; background: var(--wash); color: var(--muted); font-size: 11px; line-height: 18px; }
  .verified { background: color-mix(in srgb, var(--good) 15%, transparent); color: var(--good); }
  .self_claimed, .shared { background: color-mix(in srgb, var(--warn) 15%, transparent); color: var(--warn); }
  a { color: inherit; }
  button { all: unset; box-sizing: border-box; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; min-height: 28px; padding: 0 9px; border: 1px solid var(--line); border-radius: 6px; font-size: 12px; font-weight: 500; color: var(--fg); background: var(--bg); }
  button:hover { background: var(--wash); }
  button.primary { background: var(--accent); border-color: var(--accent); color: var(--accent-fg); }
  button.x { border-color: transparent; min-height: 22px; padding: 0 5px; color: var(--muted); }
  :focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
  label { display: block; margin-top: 8px; font-size: 12px; font-weight: 500; }
  input, select, textarea { display: block; width: 100%; margin-top: 3px; padding: 5px 7px; border: 1px solid var(--line); border-radius: 6px; background: var(--bg); color: var(--fg); font-size: 13px; }
  textarea { resize: vertical; }
  .actions { display: flex; gap: 6px; margin-top: 10px; flex-wrap: wrap; }
  .err { color: var(--bad); font-size: 12px; margin-top: 6px; }
  .ok { color: var(--good); font-weight: 500; }
`;

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

function details(root: HTMLElement, found: DetectedAddress, labels: ResolvedLabel[], onEdit: () => void) {
  const top = labels[0]!;
  const copy = el("button", { textContent: "Copy", ariaLabel: "Copy address" });
  copy.addEventListener("click", async () => {
    await navigator.clipboard.writeText(found.raw); // Only ever on this explicit click.
    copy.textContent = "Copied";
  });
  const view = el("button", { textContent: "View profile" });
  view.addEventListener("click", () => {
    const path = top.entity?.slug ? `/p/${top.entity.slug}` : top.walletId ? `/wallets/${top.walletId}` : top.entity ? `/entities/${top.entity.id}` : "/dashboard";
    void send({ type: "open", path });
  });
  // An account with no wallet has no address to tag, so editing happens in the dashboard.
  const noWallet = (found.kind as string) === "x";
  const edit = el("button", { textContent: noWallet ? "Edit" : top.source === "private" ? "Edit tag" : "Add my tag" });
  edit.addEventListener("click", () => {
    if (noWallet) void send({ type: "open", path: top.entity ? `/entities/${top.entity.id}` : "/dashboard" });
    else onEdit();
  });
  const report = el("button", { textContent: "Report" });
  report.addEventListener("click", () => void send({ type: "open", path: top.entity?.slug ? `/p/${top.entity.slug}#report` : "/dashboard" }));

  const links = el("div", { className: "row sec" });
  for (const l of top.links.slice(0, 6)) {
    const url = l.type === "ens" ? linkHref("ens", l.url) : sanitizeUrl(l.url);
    if (url) links.append(el("a", { href: url, target: "_blank", rel: "noopener noreferrer nofollow", textContent: l.label || LINK_TYPE_LABELS[l.type as LinkType] || "Link" }));
  }
  const parts: (Node | null)[] = [
    el("div", { className: "row between" }, el("h2", { textContent: top.label }), el("span", { className: `pill ${top.source}`, textContent: top.entity?.verification === "verified" ? "✓ Verified" : top.source.replace("_", "-") })),
    el("div", { className: "row sec between" }, el("span", { className: "addr", title: found.raw, textContent: truncateAddress(found.raw) }), copy),
    top.entity ? el("div", { className: "sec" }, "Entity: ", el("b", { textContent: top.entity.name }), el("span", { className: "muted", textContent: ` · ${top.entity.linkedWallets} wallet${top.entity.linkedWallets === 1 ? "" : "s"} linked` })) : null,
    el("div", { className: "sec muted", textContent: `${CHAINS[top.chain as keyof typeof CHAINS]?.name ?? top.chain}${top.status && top.status !== "none" ? ` · ${top.status}` : ""}` }),
    top.tags.length ? el("div", { className: "row sec" }, ...top.tags.slice(0, 8).map((t) => el("span", { className: "pill", textContent: t }))) : null,
    top.notes ? el("div", { className: "sec", textContent: top.notes }) : null,
    top.links.length ? links : null,
    el("div", { className: "sec muted", textContent: `Source: ${top.provenance}` }),
    labels.length > 1 ? el("div", { className: "muted", textContent: `Also: ${labels.slice(1).map((l) => `${l.label} (${l.provenance})`).join(", ")}` }) : null,
    el("div", { className: "actions" }, view, edit, report),
  ];
  root.append(...parts.filter((p): p is Node => p !== null));
}

async function tagForm(root: HTMLElement, found: DetectedAddress, labels: ResolvedLabel[], host: string, onClose: () => void) {
  const mine = labels.find((l) => l.source === "private");
  root.replaceChildren(el("div", { className: "muted", textContent: "Loading…" }));
  const boot = await send<Bootstrap | null>({ type: "bootstrap" });
  const status = await send<{ connected: boolean }>({ type: "status" });
  root.replaceChildren();
  if (!status.connected) {
    const connect = el("button", { className: "primary", textContent: "Connect account" });
    connect.addEventListener("click", () => void send({ type: "open", path: `/extension/connect?ext=${chrome.runtime.id}` }));
    root.append(el("h2", { textContent: "Connect to save tags" }), el("p", { className: "muted", textContent: "Tags are private to your account. Connect once and this browser stays signed in." }), connect);
    return;
  }
  const name = el("input", { value: mine?.label ?? "", placeholder: "Alice's trading wallet", required: true, maxLength: 120 });
  const chain = el("select");
  const family = found.kind === "evm" ? CHAIN_IDS.filter((c) => CHAINS[c].family === "evm") : CHAIN_IDS.filter((c) => CHAINS[c].family === found.kind);
  for (const c of family) chain.append(el("option", { value: c, textContent: CHAINS[c].name }));
  chain.value = mine?.chain ?? chainFromHost(host, found.kind);
  const entity = el("select");
  entity.append(el("option", { value: "", textContent: "None" }), el("option", { value: "__new", textContent: "New entity…" }));
  for (const e of boot?.entities ?? []) entity.append(el("option", { value: e.id, textContent: e.name }));
  const newEntity = el("input", { placeholder: "Entity name", hidden: true, maxLength: 120 });
  entity.addEventListener("change", () => { newEntity.hidden = entity.value !== "__new"; });
  const tags = el("input", { value: mine?.tags.join(", ") ?? "", placeholder: "trader, watchlist" });
  const notes = el("textarea", { value: mine?.notes ?? "", rows: 2 });
  const linkUrl = el("input", { placeholder: "X handle or URL" });
  const list = el("select");
  for (const l of boot?.lists ?? []) list.append(el("option", { value: l.id, textContent: l.visibility === "shared" ? `${l.name} (shared)` : l.name }));
  list.append(el("option", { value: "__new", textContent: "New list…" }));
  if (boot?.lastListId && boot.lists.some((l) => l.id === boot.lastListId)) list.value = boot.lastListId;
  const newList = el("input", { placeholder: "List name", hidden: list.value !== "__new", maxLength: 80 });
  const privacy = el("div", { className: "muted sec" });
  const syncPrivacy = () => {
    newList.hidden = list.value !== "__new";
    const chosen = boot?.lists.find((l) => l.id === list.value);
    privacy.textContent = chosen?.visibility === "shared" ? `Shared: members of ${chosen.name} will see this tag.` : "Private: only you will see this tag.";
  };
  list.addEventListener("change", syncPrivacy);
  syncPrivacy();
  const error = el("div", { className: "err", role: "alert" });
  const save = el("button", { className: "primary", textContent: "Save", type: "submit" });
  const cancel = el("button", { textContent: "Cancel", type: "button" });
  cancel.addEventListener("click", onClose);
  const form = el("form", { noValidate: true },
    el("h2", { textContent: mine ? "Edit tag" : "Tag this wallet" }),
    el("div", { className: "addr sec", title: found.raw, textContent: truncateAddress(found.raw) }),
    el("label", {}, "Name", name), family.length > 1 ? el("label", {}, "Chain", chain) : null,
    el("label", {}, "Entity", entity, newEntity), el("label", {}, "Tags", tags), el("label", {}, "Notes", notes),
    el("label", {}, "X or link", linkUrl), el("label", {}, "List", list, newList), privacy, error,
    el("div", { className: "actions" }, save, cancel),
  );
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!name.value.trim()) { error.textContent = "Add a name."; name.focus(); return; }
    save.setAttribute("disabled", "");
    const url = linkUrl.value.trim();
    const isX = /^@|^[A-Za-z0-9_]{1,15}$|(x|twitter)\.com/.test(url);
    const result = await send<TagResult>({
      type: "tag",
      input: {
        address: found.raw, chain: family.length > 1 ? chain.value : family[0]!, displayLabel: name.value.trim(), notes: notes.value,
        tags: tags.value.split(",").map((t) => t.trim()).filter(Boolean), links: url ? [{ type: isX ? "x" : "custom", url, label: "", status: "source" }] : [],
        status: mine?.status ?? "none",
        listId: list.value && list.value !== "__new" ? list.value : undefined, newListName: list.value === "__new" ? newList.value.trim() || "Research" : undefined,
        entityId: entity.value && entity.value !== "__new" ? entity.value : undefined, newEntityName: entity.value === "__new" ? newEntity.value.trim() || undefined : undefined,
      },
    });
    if (!result.ok) { error.textContent = result.error; save.removeAttribute("disabled"); return; }
    root.replaceChildren(el("p", { className: "ok", role: "status", textContent: result.queued ? `Saved. It will sync to ${result.listName} when you're back online.` : `Saved to ${result.listName}.` }));
    setTimeout(onClose, 1400);
  });
  root.append(form);
  name.focus();
}

export async function openCard(anchor: HTMLElement, found: DetectedAddress, labels: ResolvedLabel[], settings: Settings, host: string) {
  closeCard();
  const cardHost = document.createElement("tagawallet-card");
  cardHost.setAttribute("data-theme", settings.theme);
  const shadow = cardHost.attachShadow({ mode: "open" });
  const root = el("div", { className: "card", role: "dialog", ariaLabel: "Wallet details", tabIndex: -1 });
  shadow.append(el("style", { textContent: CARD_CSS }), root);
  document.documentElement.append(cardHost);
  const rect = anchor.getBoundingClientRect();
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") { closeCard(); anchor.shadowRoot?.querySelector("button")?.focus(); return; }
    if (e.key !== "Tab") return;
    const items = [...root.querySelectorAll<HTMLElement>("button,a,input:not([hidden]),select,textarea")];
    if (!items.length) return;
    const first = items[0]!, last = items[items.length - 1]!, activeEl = shadow.activeElement;
    if (e.shiftKey && (activeEl === first || activeEl === null)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && activeEl === last) { e.preventDefault(); first.focus(); }
  };
  const onDown = (e: MouseEvent) => { if (!e.composedPath().includes(cardHost)) closeCard(); };
  document.addEventListener("keydown", onKey, true);
  document.addEventListener("mousedown", onDown, true);
  current = { host: cardHost, cleanup: () => { document.removeEventListener("keydown", onKey, true); document.removeEventListener("mousedown", onDown, true); } };
  const reposition = () => position(cardHost, rect, root);
  const edit = async () => { await tagForm(root, found, labels, host, closeCard); reposition(); };
  if (labels.length) {
    details(root, found, labels, () => void edit());
    reposition();
    root.querySelector("button")?.focus();
  } else {
    reposition();
    await edit();
  }
}
