import { CHAIN_IDS, CHAINS, parsePastedAddress, truncateAddress } from "@tagawallet/shared/lite";
import { chainFromLocation, send, QUICK_STATUSES, type Bootstrap, type ResolvedLabel, type TagResult } from "./messages";

/**
 * The one quick-tag form, used by the in-page card and the toolbar popup alike.
 * Plain DOM so the content script stays small and can render it inside a shadow root.
 */

export const TAG_FORM_CSS = `
  .tf [hidden] { display: none !important; }
  .tf h2 { margin: 0; font-size: 15px; font-weight: 600; }
  .tf .meta { display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-top: 4px; }
  .tf .addr { font-family: ui-monospace, Menlo, monospace; font-size: 12px; color: var(--muted); }
  .tf .mini { width: auto; margin: 0; padding: 1px 4px; border-color: transparent; background: transparent; color: var(--muted); font-size: 12px; }
  .tf .mini:hover { border-color: var(--line); }
  .tf label { display: block; margin-top: 10px; font-size: 12px; font-weight: 500; }
  .tf input, .tf select, .tf textarea { display: block; width: 100%; margin-top: 3px; padding: 6px 8px; border: 1px solid var(--line); border-radius: 6px; background: var(--card, var(--bg)); color: var(--fg); font: inherit; font-size: 13px; }
  .tf textarea { resize: vertical; }
  .tf .chips { display: flex; flex-wrap: wrap; gap: 4px; margin: 4px 0 6px; }
  .tf .chip { all: unset; box-sizing: border-box; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; height: 24px; padding: 0 9px; border: 1px solid var(--line); border-radius: 99px; font-size: 12px; font-weight: 500; color: var(--muted); background: transparent; }
  .tf .chip::before { content: ""; width: 7px; height: 7px; border-radius: 99px; background: var(--tone); }
  .tf .chip:hover { color: var(--fg); background: var(--wash); }
  .tf .chip[aria-pressed=true] { color: var(--fg); border-color: var(--tone); background: color-mix(in srgb, var(--tone) 14%, transparent); }
  .tf .chip:focus-visible, .tf .link:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
  .tf .link { all: unset; cursor: pointer; margin-top: 8px; font-size: 12px; color: var(--muted); }
  .tf .link:hover { color: var(--fg); text-decoration: underline; }
  .tf .dest { display: flex; align-items: center; gap: 6px; margin-top: 12px; padding: 7px 8px; border-radius: 8px; background: var(--wash); font-size: 12px; color: var(--muted); }
  .tf .dest select { width: auto; flex: 1; min-width: 0; margin: 0; padding: 2px 4px; border-color: transparent; background: transparent; font-weight: 600; color: var(--fg); }
  .tf .dest .vis { flex: none; font-weight: 500; }
  .tf .dest .vis.shared { color: var(--warn); }
  .tf .opt { font-weight: 400; color: var(--muted); }
  .tf .err { margin-top: 8px; color: var(--bad); font-size: 12px; }
  .tf .err:empty { display: none; }
  .tf .actions { display: flex; gap: 6px; margin-top: 12px; }
  .tf .actions button { flex: 1; }
`;

const TONES: Record<string, string> = { mine: "var(--accent)", trusted: "var(--good)", watchlist: "var(--warn)", scam: "var(--bad)" };

function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, unknown> = {}, ...children: (Node | string | null | undefined | false)[]): HTMLElementTagNameMap[K] {
  const e = Object.assign(document.createElement(tag), props) as HTMLElementTagNameMap[K];
  e.append(...children.filter((c): c is Node | string => !!c));
  return e;
}

export interface TagFormOptions {
  /** Empty means the person pastes one, as in the popup. */
  address: string;
  kind?: "evm" | "solana" | "bitcoin";
  existing?: ResolvedLabel | null;
  boot: Bootstrap | null;
  host: string;
  path: string;
  heading?: boolean;
  onDone: (message: string) => void;
  onCancel: () => void;
  onLayout?: () => void;
}

export function buildTagForm(o: TagFormOptions): HTMLFormElement {
  const mine = o.existing ?? null;
  const layout = () => o.onLayout?.();
  const pasting = !o.address;

  // Address and chain. EVM addresses are the same on every EVM chain, so the chain is a quiet secondary choice.
  const address = h("input", { value: o.address, className: "addr", spellcheck: false, autocomplete: "off", placeholder: "0x…, Solana or Bitcoin address" });
  address.setAttribute("aria-label", "Address");
  const chain = h("select", { className: "mini" });
  chain.setAttribute("aria-label", "Chain");
  const fillChains = (kind: string) => {
    const options = CHAIN_IDS.filter((c) => CHAINS[c].family === kind);
    chain.replaceChildren(...options.map((c) => h("option", { value: c, textContent: CHAINS[c].name })));
    chain.value = mine?.chain && options.includes(mine.chain as never) ? mine.chain : chainFromLocation(o.host, o.path, kind);
    if (!options.includes(chain.value as never)) chain.value = options[0] ?? "ethereum";
    chain.hidden = options.length < 2;
  };
  fillChains(o.kind ?? "evm");
  address.addEventListener("input", () => {
    const parsed = parsePastedAddress(address.value);
    if (parsed && (parsed.kind === "evm" || parsed.kind === "solana" || parsed.kind === "bitcoin")) fillChains(parsed.kind);
  });

  const name = h("input", { value: mine?.label ?? "", placeholder: "Alice's trading wallet", maxLength: 120 });
  name.setAttribute("aria-label", "Name");

  // Labels: the four built-ins are one tap (stored as status), your own go in a text field (stored as tags).
  let status = mine?.status && mine.status !== "none" ? mine.status : "none";
  const chips = h("div", { className: "chips" });
  const paint = () => chips.querySelectorAll<HTMLButtonElement>(".chip").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.value === status)));
  for (const [value, label] of QUICK_STATUSES) {
    const b = h("button", { type: "button", className: "chip", textContent: label });
    b.dataset.value = value;
    b.style.setProperty("--tone", TONES[value] ?? "var(--muted)");
    b.addEventListener("click", () => { status = status === value ? "none" : value; paint(); });
    chips.append(b);
  }
  paint();
  const tags = h("input", { value: mine?.tags.join(", ") ?? "", placeholder: "Your own, e.g. trader, whale" });
  tags.setAttribute("aria-label", "Your own labels");
  const labels = h("div", { role: "group" }, chips, tags);
  labels.setAttribute("aria-label", "Labels");

  const notes = h("textarea", { value: mine?.notes ?? "", rows: 2 });
  notes.setAttribute("aria-label", "Notes");
  const notesWrap = h("label", { hidden: !mine?.notes }, "Note", notes);
  const addNote = h("button", { type: "button", className: "link", textContent: "+ Add a note", hidden: !!mine?.notes });
  addNote.addEventListener("click", () => { notesWrap.hidden = false; addNote.hidden = true; notes.focus(); layout(); });

  // One "List" picker for plain lists, people and projects. Optional: a wallet doesn't need one.
  const lists = o.boot?.lists ?? [];
  const entities = o.boot?.entities ?? [];
  const list = h("select");
  list.setAttribute("aria-label", "List");
  const group = (label: string, items: { value: string; text: string }[]) =>
    items.length ? h("optgroup", { label }, ...items.map((i) => h("option", { value: i.value, textContent: i.text }))) : null;
  list.append(
    h("option", { value: "", textContent: "None" }),
    ...[
      group("Lists", lists.map((l) => ({ value: `l:${l.id}`, text: l.visibility === "shared" ? `${l.name} (shared)` : l.name }))),
      group("People", entities.filter((e) => e.type === "individual").map((e) => ({ value: `e:${e.id}`, text: e.name }))),
      group("Projects", entities.filter((e) => e.type !== "individual").map((e) => ({ value: `e:${e.id}`, text: e.name }))),
    ].filter((g): g is HTMLOptGroupElement => !!g),
    h("option", { value: "__new", textContent: "New list…" }),
  );
  if (mine?.entity && entities.some((e) => e.id === mine.entity!.id)) list.value = `e:${mine.entity.id}`;
  const newList = h("input", { placeholder: "List name", maxLength: 80, hidden: true });
  newList.setAttribute("aria-label", "New list name");
  const vis = h("span", { className: "vis" });
  // A name that mentions someone you already track is probably theirs.
  const suggest = h("button", { type: "button", className: "link", hidden: true });
  let suggested = "";
  const sync = () => {
    newList.hidden = list.value !== "__new";
    const shared = lists.find((l) => `l:${l.id}` === list.value && l.visibility === "shared");
    vis.className = `vis${shared ? " shared" : ""}`;
    vis.textContent = shared ? `Shared with ${shared.name}` : "Private to you";
    const n = name.value.toLowerCase();
    const match = !list.value && n.length > 2 ? entities.find((e) => n.includes(e.name.toLowerCase())) : undefined;
    suggested = match ? `e:${match.id}` : "";
    suggest.hidden = !match;
    if (match) suggest.textContent = `Add to ${match.name}?`;
    layout();
  };
  suggest.addEventListener("click", () => { list.value = suggested; sync(); });
  list.addEventListener("change", sync);
  name.addEventListener("input", sync);
  sync();
  const dest = h("div", { className: "dest" }, vis);

  const error = h("div", { className: "err", role: "alert" });
  const save = h("button", { type: "submit", className: "primary", textContent: "Save" });
  const cancel = h("button", { type: "button", textContent: "Cancel" });
  cancel.addEventListener("click", o.onCancel);

  const form = h("form", { className: "tf", noValidate: true },
    o.heading !== false && h("h2", { textContent: mine ? "Edit tag" : "Tag this wallet" }),
    pasting
      ? h("label", {}, "Address", address)
      : h("div", { className: "meta" }, h("span", { className: "addr", title: o.address, textContent: truncateAddress(o.address) }), chain),
    pasting && h("div", { className: "meta" }, h("span", {}), chain),
    h("label", {}, "Name", name),
    h("label", {}, "Labels", labels),
    h("label", {}, "List", h("span", { className: "opt", textContent: " · optional" }), list),
    newList,
    suggest,
    addNote,
    notesWrap,
    dest,
    error,
    h("div", { className: "actions" }, save, cancel),
  );

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    error.textContent = "";
    const parsed = parsePastedAddress(address.value);
    if (!parsed || parsed.kind === "ens" || parsed.kind === "sns") { error.textContent = "Paste a wallet address."; address.focus(); return; }
    if (!name.value.trim()) { error.textContent = "Add a name."; name.focus(); return; }
    if (list.value === "__new" && !newList.value.trim()) { error.textContent = "Name the new list, or pick None."; newList.focus(); layout(); return; }
    const family = parsed.kind;
    const chosenChain = CHAINS[chain.value as keyof typeof CHAINS]?.family === family ? chain.value : CHAIN_IDS.find((c) => CHAINS[c].family === family)!;
    save.disabled = true;
    const [kind, id] = list.value.split(":");
    const r = await send<TagResult>({ type: "tag", input: {
      address: parsed.raw, chain: chosenChain, displayLabel: name.value.trim(), notes: notes.value, status,
      tags: tags.value.split(",").map((t) => t.trim()).filter(Boolean),
      listId: kind === "l" ? id : undefined, entityId: kind === "e" ? id : undefined,
      newListName: list.value === "__new" ? newList.value.trim() : undefined,
    } });
    save.disabled = false;
    if (!r.ok) { error.textContent = r.error; layout(); return; }
    const target = list.value === "__new" ? newList.value.trim() : list.selectedOptions[0]?.textContent?.replace(/ \(shared\)$/, "");
    const where = list.value ? ` to ${target}` : "";
    o.onDone(r.queued ? `Saved${where}. It will sync when you're back online.` : `Saved${where}.`);
  });

  queueMicrotask(() => (pasting ? address : name).focus());
  return form;
}
