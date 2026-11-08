import { useEffect, useState } from "react";
import { linkHref, normalizeAddress, sanitizeUrl } from "@tagawallet/shared/lite";
import { linkText } from "../lib/links";

import { send, type Loaded, type ResolvedLabel, type Route, type UntagResult, type WalletFiling } from "../lib/messages";
import { displayName, labelPath, roleWord, type Target } from "../lib/parts";
import { Avatar, chainName, CopyButton, Empty, FadeText, Icon, KIND_LABEL, kindOf, Labels, Skeleton, type Kind } from "./ui";

/** Who said it, in plain words, with the tone the dashboard uses. */
export const SOURCE: Record<string, { word: string; tone: string }> = {
  private: { word: "Your tag", tone: "" }, shared: { word: "Shared list", tone: "warn" }, verified: { word: "✓ Verified", tone: "good" },
  official: { word: "✓ Official", tone: "good" }, self_claimed: { word: "Public", tone: "accent" }, community: { word: "Public", tone: "accent" },
};
const FAMILY_CHAIN: Record<string, string> = { evm: "ethereum", solana: "solana", bitcoin: "bitcoin" };

export interface WalletProps {
  address: string;
  kind: Target["kind"];
  /** The tab the panel belongs to, so Find can point at the address on the page. */
  tabId?: number;
  version: number;
  onBack: () => void;
  onTag: (t: Target) => void;
  onRoute: (r: Route) => void;
  open: (path: string) => void;
  say: (m: string) => void;
  /** After a removal, so lists and the page reload. */
  onChanged: () => void;
}

/** One wallet in full: every label anyone you trust gave it, where it's filed, and what you can do with it. */
export function WalletView({ address, kind, tabId, version, onBack, onTag, onRoute, open, say, onChanged }: WalletProps) {
  const normalized = normalizeAddress(address, kind);
  const [labels, setLabels] = useState<ResolvedLabel[] | null>(null);
  const [onPage, setOnPage] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState("");

  const [filing, setFiling] = useState<WalletFiling | null>(null);
  useEffect(() => {
    let live = true;
    void send<Record<string, ResolvedLabel[]>>({ type: "resolve", addresses: [{ normalized, kind }] }).then((r) => {
      if (!live) return;
      const list = r?.[normalized] ?? [];
      setLabels(list);
      // Your own record knows every list and contact it's in; a label alone only names one.
      const walletId = list.find((l) => l.walletId && (l.source === "private" || l.source === "shared"))?.walletId;
      if (walletId) void send<Loaded<WalletFiling>>({ type: "wallet", id: walletId }).then((f) => { if (live) setFiling(f?.data ?? null); });
      else setFiling(null);
    });
    return () => { live = false; };
  }, [normalized, kind, version]);
  // Find only makes sense when the address is on the page the panel belongs to.
  useEffect(() => {
    if (tabId === undefined) return;
    void chrome.tabs.sendMessage(tabId, { type: "taw:scan" }).then((r: { detected?: { normalized: string }[] }) => {
      setOnPage(!!r?.detected?.some((d) => d.normalized === normalized));
    }, () => setOnPage(false));
  }, [tabId, normalized]);

  const back = <div className="crumb"><button type="button" className="btn sm ghost press" onClick={onBack}><Icon name="chevronLeft" size={14} />Back</button></div>;
  if (!labels) return <div>{back}<Skeleton rows={4} /></div>;

  const top = labels[0];
  const mine = labels.find((l) => l.source === "private");
  const name = top ? displayName(top) : "Not tagged yet";
  const role = top ? roleWord(top) : "";
  const own = top?.entity && top.label && top.label !== top.entity.name ? top.label : "";
  const chain = top?.chain ?? FAMILY_CHAIN[kind] ?? kind;
  const verified = top?.source === "verified" || top?.source === "official" || top?.entity?.verification === "verified";
  const isPublic = top && ["verified", "official", "self_claimed", "community"].includes(top.source);
  const src = top ? SOURCE[top.source] ?? { word: top.source, tone: "" } : null;
  const tag = () => onTag({ address, kind, existing: mine ?? null });
  // Contacts first, then lists, each opening in place. Without your own record, what the label itself names.
  type Filed = { kind: Kind; note?: string; route: Extract<Route, { view: "collection" }> };
  const filed: Filed[] = filing
    ? [
      ...filing.entities.map((e) => ({ kind: kindOf(e.type), note: e.relationship && e.relationship !== "associated" ? e.relationship.replace(/_/g, " ") : undefined, route: { view: "collection" as const, kind: "entity" as const, id: e.id, name: e.name, type: e.type } })),
      ...filing.lists.map((l) => ({ kind: "list" as Kind, note: l.visibility === "shared" ? "shared" : undefined, route: { view: "collection" as const, kind: "list" as const, id: l.id, name: l.name } })),
    ]
    : top?.entity ? [{ kind: "person" as Kind, note: role || undefined, route: { view: "collection" as const, kind: "entity" as const, id: top.entity.id, name: top.entity.name } }] : [];

  async function remove() {
    if (!mine) return;
    setError("");
    const r = await send<UntagResult>({ type: "untag", address, chain: mine.chain });
    if (!r.ok) { setError(r.error); return; }
    setConfirm(false);
    say(r.queued ? "Removed. It will sync when you're back online." : "Removed.");
    onChanged();
  }
  async function find() {
    if (tabId === undefined) return;
    const r = await chrome.tabs.sendMessage(tabId, { type: "taw:locate", normalized }).catch(() => null) as { found?: boolean } | null;
    if (!r?.found) say("That address isn't on the page any more.");
  }

  return (
    <div>
      {back}
      <div className="title-row">
        <Avatar name={top ? name : "?"} kind={top?.entity ? "person" : "list"} />
        <h1><FadeText>{name}</FadeText></h1>
        {src && <span className={`pill ${verified ? "good" : src.tone}`} title={top!.provenance}>{verified ? "✓ Verified" : src.word}</span>}
      </div>
      {(role || own) && <p className="muted" style={{ margin: "4px 0 0 32px", fontSize: 13 }}>{[role && role[0]!.toUpperCase() + role.slice(1), own && own.toLowerCase() !== role.toLowerCase() ? own : ""].filter(Boolean).join(" · ")}</p>}

      <div className="addr-box">
        <div>
          <div className="full">{address}</div>
          <div className="muted">{chainName(chain)}</div>
        </div>
        <CopyButton text={address} />
      </div>
      <div className="detail-acts">
        <button type="button" className="btn primary press" onClick={tag}><Icon name="tag" size={14} />{mine ? "Edit tag" : top ? "Add my tag" : "Tag this wallet"}</button>
        {onPage && <button type="button" className="btn press" onClick={() => void find()}><Icon name="target" size={14} />Find on page</button>}
      </div>

      {top && (top.status && top.status !== "none" || top.tags.length > 0) && (
        <section className="detail-sec" aria-label="Labels">
          <h2>Labels</h2>
          <Labels status={top.status} tags={top.tags} max={12} />
        </section>
      )}

      {filed.length > 0 && (
        <section className="detail-sec" aria-label="Filed in">
          <h2>Filed in</h2>
          <ul className="plain">
            {filed.map((f) => (
              <li key={`${f.route.kind}:${f.route.id}`}>
                <button type="button" className="item press" onClick={() => onRoute(f.route)}>
                  <Avatar name={f.route.name} kind={f.kind} />
                  <span className="grow"><FadeText>{f.route.name}{f.note && <span className="note">{f.note}</span>}</FadeText></span>
                  <span className="count">{KIND_LABEL[f.kind]}</span>
                  <Icon name="chevronRight" size={14} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {mine?.notes && (
        <section className="detail-sec" aria-label="Your note">
          <h2>Your note</h2>
          <p className="note-text">{mine.notes}</p>
        </section>
      )}

      {top && top.links.length > 0 && (
        <section className="detail-sec" aria-label="Links">
          <h2>Links</h2>
          <div className="link-row">
            {top.links.slice(0, 8).map((l, i) => {
              const url = l.type === "ens" ? linkHref("ens", l.url) : sanitizeUrl(l.url);
              return url ? <a key={i} className="pill link-pill" href={url} target="_blank" rel="noopener noreferrer nofollow">{linkText(l, url)}<Icon name="external" size={12} /></a> : null;
            })}
          </div>
        </section>
      )}

      {labels.length > 1 && (
        <section className="detail-sec" aria-label="Other labels">
          <h2>Other labels</h2>
          <ul className="plain others">
            {labels.slice(1).map((l, i) => (
              <li key={i}>
                <span className="grow"><FadeText>{displayName(l)}</FadeText><span className="muted">{l.provenance}</span></span>
                <span className={`pill ${SOURCE[l.source]?.tone ?? ""}`}>{SOURCE[l.source]?.word ?? l.source}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!top && <Empty title="Nobody you follow has tagged this">Tag it and it shows up here, on the page and in your dashboard.</Empty>}
      {top && <p className="muted" style={{ margin: "14px 2px 0" }}>{top.provenance}</p>}

      <div className="detail-more">
        {top && <button type="button" className="link" onClick={() => open(labelPath(top))}>Open in dashboard ↗</button>}
        {top?.entity?.slug && <button type="button" className="link" onClick={() => open(`/p/${top.entity!.slug}`)}>Public page ↗</button>}
        {isPublic && <button type="button" className="link" onClick={() => open(top!.entity?.slug ? `/p/${top!.entity.slug}?report=${top!.linkId ?? "profile"}#report` : "/dashboard")}>Report this label</button>}
        {mine && !confirm && <button type="button" className="link bad" onClick={() => setConfirm(true)}>Remove my tag</button>}
      </div>
      {confirm && (
        <div className="callout bad" role="group" aria-label="Remove your tag">
          <p>Remove “{mine!.label}”? Your tag and its lists go. Other people&apos;s labels stay.</p>
          {error && <p className="bad" role="alert" style={{ marginTop: 4 }}>{error}</p>}
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <button type="button" className="btn sm press danger" onClick={() => void remove()}>Remove</button>
            <button type="button" className="btn sm ghost press" onClick={() => setConfirm(false)}>Keep</button>
          </div>
        </div>
      )}
    </div>
  );
}
