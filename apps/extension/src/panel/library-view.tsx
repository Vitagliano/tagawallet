import { useEffect, useMemo, useState } from "react";
import { chainFamily, normalizeAddress, parsePastedAddress, truncateAddress, type ChainId } from "@tagawallet/shared/lite";
import { send, type Collection, type Library, type Loaded, type ResolvedLabel, type SearchResult, type WalletRow } from "../lib/messages";
import { displayName, isFlagged, labelPath, roleWord, taggable, type Target } from "../lib/parts";
import { useNav } from "./nav";
import { Address, Avatar, chainName, CopyButton, Empty, FadeText, Icon, IconButton, KIND_LABEL, kindOf, Labels, Skeleton, StatusPill, WalletItem, type Kind } from "./ui";

const PREVIEW = 6;
type Pick = { kind: "list" | "entity"; id: string; name: string; type?: string };

export interface LibraryProps {
  connected: boolean;
  onTag: (t: Target) => void;
  open: (path: string) => void;
  connect: () => void;
  /** Bumped after a save, so lists and counts reload. */
  version: number;
}

const kindForChain = (chain: string): Target["kind"] => (chain === "solana" ? "solana" : chain === "bitcoin" ? "bitcoin" : "evm");
const relationship = (r?: string) => (r && r !== "associated" ? ({ owner: "Owner", treasury: "Treasury", hot_wallet: "Hot wallet", cold_wallet: "Cold wallet", custom: "Custom" } as Record<string, string>)[r] ?? r.replace(/_/g, " ") : "");

/** The dashboard's directory in the panel: search, recent wallets, then people, projects and lists. */
export function LibraryView({ connected, onTag, open, connect, version }: LibraryProps) {
  const [lib, setLib] = useState<Loaded<Library> | null>(null);
  const [q, setQ] = useState("");
  const [pick, setPick] = useState<Pick | null>(null);

  useEffect(() => {
    if (!connected) return;
    let live = true;
    // Paint the last copy at once, then swap in the fresh one.
    void send<Loaded<Library>>({ type: "library", cached: true }).then((r) => { if (live && r?.data) setLib((cur) => cur ?? r); });
    void send<Loaded<Library>>({ type: "library" }).then((r) => { if (live) setLib(r); });
    return () => { live = false; };
  }, [connected, version]);

  if (!connected) {
    return (
      <Empty title="Your contacts and lists live here">
        <p style={{ margin: "0 0 12px" }}>Connect your account to browse them and search from any page.</p>
        <button type="button" className="btn primary press" onClick={connect}>Connect account</button>
      </Empty>
    );
  }
  if (pick) return <CollectionView pick={pick} onBack={() => setPick(null)} onTag={onTag} open={open} version={version} />;

  return (
    <div>
      <div className="search">
        <Icon name="search" />
        <input type="search" aria-label="Search wallets, people and lists, or paste an address" placeholder="Search, or paste an address" spellCheck={false} value={q} onChange={(e) => setQ(e.target.value)} />
        {q && <span className="clear"><IconButton icon="x" label="Clear search" onClick={() => setQ("")} /></span>}
      </div>
      {q.trim()
        ? <SearchView q={q} lib={lib?.data ?? null} onPick={setPick} onTag={onTag} open={open} />
        : <Home lib={lib} onPick={setPick} onTag={onTag} open={open} />}
    </div>
  );
}

function Home({ lib, onPick, onTag, open }: { lib: Loaded<Library> | null; onPick: (p: Pick) => void; onTag: (t: Target) => void; open: (p: string) => void }) {
  if (!lib) return <Skeleton />;
  if (!lib.data) return <Empty title="Couldn't load your library">{lib.error === "offline" ? "You're offline. It'll be back when you are." : "Try again in a moment."}</Empty>;
  const { lists, entities, recent, counts } = lib.data;
  const people = entities.filter((e) => kindOf(e.type) === "person").sort((a, b) => a.name.localeCompare(b.name));
  const projects = entities.filter((e) => kindOf(e.type) === "project").sort((a, b) => a.name.localeCompare(b.name));
  const sortedLists = [...lists].sort((a, b) => a.name.localeCompare(b.name));
  const nothing = !counts.wallets && !lists.length && !entities.length;

  return (
    <div>
      {lib.cached && lib.error === "offline" && <p className="muted" style={{ margin: "8px 2px 0" }}>Offline. Showing what was here last time.</p>}
      {nothing && (
        <Empty title="Nothing here yet">
          Tag a wallet on any page and it shows up here, or{" "}
          <button type="button" className="link" style={{ fontSize: 13 }} onClick={() => open("/dashboard")}>start in the dashboard</button>.
        </Empty>
      )}
      {recent.length > 0 && (
        <section aria-label="Recently changed">
          <div className="group-head">
            <h2>Recently changed</h2>
            <button type="button" className="more" onClick={() => open("/dashboard")}>All {counts.wallets} ↗</button>
          </div>
          {recent.slice(0, 4).map((w) => <WalletCard key={w.id} w={w} onTag={onTag} open={open} />)}
        </section>
      )}
      <Group title="People" kind="person" items={people.map((e) => ({ id: e.id, name: e.name, count: e.walletCount, url: e.avatarUrl, note: e.isPublic ? (e.verified ? "✓ public" : "◎ public") : undefined, pick: { kind: "entity" as const, id: e.id, name: e.name, type: e.type } }))} onPick={onPick} onNew={() => open("/dashboard")} />
      <Group title="Projects" kind="project" items={projects.map((e) => ({ id: e.id, name: e.name, count: e.walletCount, url: e.avatarUrl, note: e.isPublic ? (e.verified ? "✓ public" : "◎ public") : undefined, pick: { kind: "entity" as const, id: e.id, name: e.name, type: e.type } }))} onPick={onPick} onNew={() => open("/dashboard")} />
      <Group title="Lists" kind="list" items={sortedLists.map((l) => ({ id: l.id, name: l.name, count: l.walletCount, note: [l.isPublic && "◎ public", l.shared && "⇄ shared"].filter(Boolean).join(" ") || undefined, pick: { kind: "list" as const, id: l.id, name: l.name } }))} onPick={onPick} onNew={() => open("/lists")} />
    </div>
  );
}

type Row = { id: string; name: string; count: number; url?: string; note?: string; pick: Pick };

function Group({ title, kind, items, onPick, onNew }: { title: string; kind: Kind; items: Row[]; onPick: (p: Pick) => void; onNew: () => void }) {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, PREVIEW);
  return (
    <section aria-label={title}>
      <div className="group-head">
        <h2>{title}</h2>
        <IconButton icon="plus" label={`New ${KIND_LABEL[kind].toLowerCase()} in the dashboard`} onClick={onNew} />
      </div>
      <ul className="plain">
        {shown.map((c) => (
          <li key={c.id}>
            <button type="button" className="item press" onClick={() => onPick(c.pick)}>
              <Avatar name={c.name} kind={kind} url={c.url} />
              <span className="grow"><FadeText>{c.name}{c.note && <span className="note">{c.note}</span>}</FadeText></span>
              <span className="count">{c.count}</span>
            </button>
          </li>
        ))}
        {!items.length && <li className="muted" style={{ padding: "4px 10px" }}>None yet</li>}
      </ul>
      {items.length > PREVIEW && <button type="button" className="more" onClick={() => setAll(!all)}>{all ? "Show less" : `Show ${items.length - PREVIEW} more`}</button>}
    </section>
  );
}

/** A wallet as the dashboard's table shows it: one row, opening to where it's filed, its labels and actions. */
function WalletCard({ w, onTag, open }: { w: WalletRow; onTag: (t: Target) => void; open: (p: string) => void }) {
  const entity = w.entities?.[0];
  const name = w.displayLabel || entity?.name || "";
  const role = relationship(w.relationship ?? entity?.relationship);
  const flagged = w.status === "watchlist" || w.status === "scam";
  const filed = [entity && entity.name !== name ? entity.name : "", ...(w.lists ?? []).map((l) => l.name)].filter(Boolean);
  const nav = useNav();
  return (
    <WalletItem tone={flagged ? "flagged" : "none"} title={name || truncateAddress(w.address)}
      sub={`${truncateAddress(w.address)} · ${chainName(w.chain)}${role && role.toLowerCase() !== name.toLowerCase() ? ` · ${role}` : ""}`}
      pill={<StatusPill status={w.status} />}>
      {filed.length > 0 && <p className="filed">in {filed.join(", ")}</p>}
      <Labels tags={w.tags} />
      <div className="acts">
        {w.own !== false && (
          <button type="button" className="btn sm press" onClick={async () => {
            // The form wants the label as the extension sees it, so look it up first.
            const normalized = normalizeAddress(w.address, chainFamily(w.chain as ChainId));
            const r = await send<Record<string, ResolvedLabel[]>>({ type: "resolve", addresses: [{ normalized, kind: kindForChain(w.chain) }] });
            const labels = r?.[normalized] ?? [];
            onTag({ address: w.address, kind: kindForChain(w.chain), existing: labels.find((l) => l.source === "private") ?? null });
          }}><Icon name="tag" size={14} />Edit</button>
        )}
        <button type="button" className="btn sm ghost press" onClick={() => nav.go({ view: "wallet", address: w.address, kind: kindForChain(w.chain) })}><Icon name="chevronRight" size={14} />Details</button>
        <CopyButton text={w.address} />
      </div>
    </WalletItem>
  );
}

export function CollectionView({ pick, onBack, onTag, open, version, backLabel = "Library" }: { pick: Pick; onBack: () => void; onTag: (t: Target) => void; open: (p: string) => void; version: number; backLabel?: string }) {
  const [res, setRes] = useState<Loaded<Collection> | null>(null);
  const [filter, setFilter] = useState("");
  useEffect(() => {
    let live = true;
    void send<Loaded<Collection>>({ type: "collection", kind: pick.kind, id: pick.id }).then((r) => { if (live) setRes(r); });
    return () => { live = false; };
  }, [pick.kind, pick.id, version]);
  const kind: Kind = pick.kind === "list" ? "list" : kindOf(pick.type ?? res?.data?.type);
  const c = res?.data;
  const term = filter.trim().toLowerCase();
  const wallets = (c?.wallets ?? []).filter((w) => !term || [w.displayLabel, w.address, ...(w.tags ?? [])].some((v) => v?.toLowerCase().includes(term)));
  const path = pick.kind === "list" ? `/lists/${pick.id}` : `/entities/${pick.id}`;

  return (
    <div>
      <div className="crumb">
        <button type="button" className="btn sm ghost press" onClick={onBack}><Icon name="chevronLeft" size={14} />{backLabel}</button>
      </div>
      <div className="title-row">
        <Avatar name={pick.name} kind={kind} />
        <h1 className="fade">{c?.name ?? pick.name}</h1>
        <button type="button" className="btn sm press" aria-label={`Open ${c?.name ?? pick.name} in the dashboard`} onClick={() => open(path)}><Icon name="external" size={14} />Dashboard</button>
      </div>
      <div className="meta">
        <span className="pill">{KIND_LABEL[kind]}</span>
        {c && <span className="pill">{c.total} wallet{c.total === 1 ? "" : "s"}</span>}
        {c?.verified && <span className="pill good">✓ Verified</span>}
        {c?.isPublic && <span className="pill accent">Public</span>}
        {c?.shared && <span className="pill warn">Shared</span>}
        {c?.role === "viewer" && <span className="pill">View only</span>}
      </div>
      {c?.description && <p className="muted" style={{ margin: "8px 0 0", fontSize: 13 }}>{c.description}</p>}

      {!res && <Skeleton rows={4} />}
      {res && !c && <Empty title="Couldn't open this">{res.error === "offline" ? "You're offline." : res.error ?? "Try again in a moment."}</Empty>}
      {c && c.wallets.length > 6 && (
        <div className="search" style={{ marginTop: 12 }}>
          <Icon name="search" />
          <input type="search" aria-label={`Filter ${c.name}`} placeholder={`Filter ${c.total} wallets`} spellCheck={false} value={filter} onChange={(e) => setFilter(e.target.value)} />
        </div>
      )}
      {c && c.wallets.length === 0 && <Empty title="No wallets here yet">Tag a wallet on any page and pick {c.name} in the form.</Empty>}
      <div style={{ marginTop: 12 }}>
        {wallets.map((w) => <WalletCard key={w.id} w={w} onTag={onTag} open={open} />)}
      </div>
      {c && c.total > c.wallets.length && (
        <button type="button" className="btn sm ghost press" style={{ marginTop: 10 }} onClick={() => open(path)}>See all {c.total} in the dashboard ↗</button>
      )}
    </div>
  );
}

/** One box for everything: a pasted address gets a lookup, words search wallets and the directory. */
function SearchView({ q, lib, onPick, onTag, open }: { q: string; lib: Library | null; onPick: (p: Pick) => void; onTag: (t: Target) => void; open: (p: string) => void }) {
  const parsed = useMemo(() => parsePastedAddress(q), [q]);
  const [lookup, setLookup] = useState<{ address: string; kind: Target["kind"]; labels: ResolvedLabel[] } | null>(null);
  const [found, setFound] = useState<SearchResult | null>(null);
  const [busy, setBusy] = useState(false);
  const term = q.trim().toLowerCase();
  const nav = useNav();

  useEffect(() => {
    setLookup(null);
    if (!parsed || !taggable(parsed.kind)) return;
    let live = true;
    const kind = parsed.kind;
    void send<Record<string, ResolvedLabel[]>>({ type: "resolve", addresses: [{ normalized: parsed.normalized, kind }] })
      .then((r) => { if (live) setLookup({ address: parsed.raw, kind, labels: r?.[parsed.normalized] ?? [] }); });
    return () => { live = false; };
  }, [parsed]);

  useEffect(() => {
    if (parsed || term.length < 2) { setFound(null); return; }
    let live = true;
    setBusy(true);
    // Typing is debounced, so a fast typist sends one search, not ten.
    const t = setTimeout(() => {
      void send<Loaded<SearchResult>>({ type: "search", q: term }).then((r) => { if (live) { setFound(r?.data ?? { wallets: [], entities: [] }); setBusy(false); } });
    }, 220);
    return () => { live = false; clearTimeout(t); };
  }, [term, parsed]);

  if (parsed) {
    if (!taggable(parsed.kind)) return <Empty title="That's a name, not an address">Open it on an explorer and tag the address it points to.</Empty>;
    if (!lookup) return <Skeleton rows={2} />;
    const top = lookup.labels[0];
    const mine = lookup.labels.some((l) => l.source === "private");
    return (
      <div style={{ marginTop: 10 }}>
        <div className={`wallet${isFlagged(lookup.labels) ? " flagged" : ""}`}>
          <div className="top">
            <span className="name fade">{top ? displayName(top) : "Not tagged yet"}</span>
            {top && <span className={`pill${top.source === "verified" ? " good" : ""}`} title={top.provenance}>{top.source === "verified" ? "✓ Verified" : top.source === "private" ? "Your tag" : top.source === "shared" ? "Shared" : "Public"}</span>}
          </div>
          <div className="addr"><Address value={lookup.address} />{top && roleWord(top) ? ` · ${roleWord(top)}` : ""}</div>
          {top?.entity && <div className="muted" style={{ marginTop: 2 }}>{top.entity.linkedWallets} wallet{top.entity.linkedWallets === 1 ? "" : "s"} linked</div>}
          <Labels status={top?.status} tags={top?.tags} />
          <div className="acts">
            <button type="button" className={`btn sm press${top ? "" : " primary"}`} onClick={() => onTag({ address: lookup.address, kind: lookup.kind, existing: lookup.labels.find((l) => l.source === "private") ?? null })}>
              <Icon name="tag" size={14} />{mine ? "Edit tag" : top ? "Add my tag" : "Tag it"}
            </button>
            {top && <button type="button" className="btn sm ghost press" onClick={() => nav.go({ view: "wallet", address: lookup.address, kind: lookup.kind })}><Icon name="chevronRight" size={14} />Details</button>}
            <CopyButton text={lookup.address} />
          </div>
        </div>
      </div>
    );
  }

  // The directory is already here, so it narrows as you type; wallets come from the server.
  const local = lib ? [
    ...lib.entities.map((e) => ({ id: e.id, name: e.name, count: e.walletCount, kind: kindOf(e.type), url: e.avatarUrl, pick: { kind: "entity" as const, id: e.id, name: e.name, type: e.type } })),
    ...lib.lists.map((l) => ({ id: l.id, name: l.name, count: l.walletCount, kind: "list" as Kind, url: undefined, pick: { kind: "list" as const, id: l.id, name: l.name } })),
  ].filter((c) => c.name.toLowerCase().includes(term)).slice(0, 8) : [];

  return (
    <div>
      {local.length > 0 && (
        <section aria-label="Contacts and lists">
          <div className="group-head"><h2>Contacts and lists</h2></div>
          <ul className="plain">
            {local.map((c) => (
              <li key={c.id}>
                <button type="button" className="item press" onClick={() => onPick(c.pick)}>
                  <Avatar name={c.name} kind={c.kind} url={c.url} />
                  <span className="grow"><FadeText>{c.name}<span className="note">{KIND_LABEL[c.kind]}</span></FadeText></span>
                  <span className="count">{c.count}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {term.length >= 2 && (
        <section aria-label="Wallets">
          <div className="group-head"><h2>Wallets{found ? ` · ${found.wallets.length}` : ""}</h2>{busy && <span className="muted">Searching…</span>}</div>
          {found?.wallets.map((w) => <WalletCard key={w.id} w={w} onTag={onTag} open={open} />)}
          {found && !found.wallets.length && !local.length && <Empty title="No matches">Try a name, a label, or paste a full address.</Empty>}
          {found && !found.wallets.length && local.length > 0 && <p className="muted" style={{ padding: "0 10px" }}>No wallets match.</p>}
        </section>
      )}
    </div>
  );
}
