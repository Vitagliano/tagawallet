import { useState } from "react";
import { send, type Detected, type Settings } from "../lib/messages";
import { isFlagged, rowTitle, taggable, type Target } from "../lib/parts";
import { useNav } from "./nav";
import { requestSite } from "../lib/ui";
import { truncateAddress } from "@tagawallet/shared/lite";
import { chainName, CopyButton, Empty, FadeText, Icon, Labels, StatusPill, Switch, WalletItem } from "./ui";

type Group = "flagged" | "tagged" | "unknown";
const groupOf = (d: Detected): Group => (isFlagged(d.labels) ? "flagged" : d.labels.length ? "tagged" : "unknown");
const GROUPS: [Group, string][] = [["flagged", "Flagged"], ["tagged", "Tagged"], ["unknown", "Not tagged"]];

export interface PageProps {
  tab: chrome.tabs.Tab | null;
  host: string | null;
  /** null: the page didn't answer, so TagAWallet isn't running there. */
  detected: Detected[] | null;
  enabled: boolean;
  settings: Settings;
  onSettings: (s: Settings) => void;
  rescan: (delay?: number) => void;
  onTag: (t: Target) => void;
  open: (path: string) => void;
  toast: (m: string) => void;
}

/** Every address on the page, grouped by what you know about it. */
export function PageView({ tab, host, detected, enabled, settings, onSettings, rescan, onTag, toast }: PageProps) {
  const nav = useNav();
  const [filter, setFilter] = useState("");
  const [only, setOnly] = useState<Group | null>(null);

  async function toggleSite() {
    if (!host || !tab?.id) return;
    if (enabled) {
      onSettings(await send<Settings>({ type: "updateSettings", patch: { disabledSites: [...new Set([...settings.disabledSites, host])] } }));
      return;
    }
    // Keep this first: Chrome only shows the permission prompt straight from the click.
    const granted = await chrome.permissions.contains({ origins: [`${host === "localhost" ? "http" : "https"}://${host}/*`] });
    if (!granted && !(await requestSite(host))) return;
    onSettings(await send<Settings>({ type: "updateSettings", patch: { disabledSites: settings.disabledSites.filter((h) => h !== host) } }));
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] }).catch(() => {});
    rescan(700);
  }

  async function locate(d: Detected) {
    if (!tab?.id) return;
    const r = await chrome.tabs.sendMessage(tab.id, { type: "taw:locate", normalized: d.normalized }).catch(() => null) as { found?: boolean } | null;
    if (!r?.found) toast("That address isn't on the page any more.");
  }

  if (!host) {
    return <Empty title="Nothing to read here">Browser pages can&apos;t be scanned. Open a website, or look someone up in Library.</Empty>;
  }

  const list = detected ?? [];
  const count = (g: Group) => list.filter((d) => groupOf(d) === g).length;
  const term = filter.trim().toLowerCase();
  const shown = list.filter((d) => (!only || groupOf(d) === only) && (!term || d.raw.toLowerCase().includes(term) || (rowTitle(d.labels[0]) ?? "").toLowerCase().includes(term)));
  const untagged = list.filter((d) => groupOf(d) === "unknown" && taggable(d.kind));

  return (
    <div>
      <div className="site">
        <span className="grow">
          <strong><FadeText>{host}</FadeText></strong>
          <span className="muted">{!enabled ? "Off on this site" : detected === null ? "Starting…" : `${list.length} address${list.length === 1 ? "" : "es"} on this page`}</span>
        </span>
        <Switch on={enabled} label={`TagAWallet on ${host}`} onChange={() => void toggleSite()} />
      </div>

      {!enabled && (
        <div className="callout">
          <p>Turn it on to see names next to addresses here and list them in this panel. Only addresses are looked up, never the page.</p>
        </div>
      )}

      {enabled && detected !== null && (
        <>
          <div className="stats" role="group" aria-label="Summary">
            {(["flagged", "tagged", "unknown"] as Group[]).map((g) => (
              <button key={g} type="button" className={`stat press ${g === "flagged" ? "bad" : g === "tagged" ? "good" : ""}`} aria-pressed={only === g}
                onClick={() => setOnly(only === g ? null : g)}>
                <b>{count(g)}</b><span>{g === "flagged" ? "Flagged" : g === "tagged" ? "Tagged" : "Not tagged"}</span>
              </button>
            ))}
          </div>

          {list.length > 5 && (
            <div className="search" style={{ marginTop: 8 }}>
              <Icon name="search" />
              <input type="search" aria-label="Filter addresses" placeholder="Filter by name or address" spellCheck={false} value={filter} onChange={(e) => setFilter(e.target.value)} />
            </div>
          )}

          {list.length === 0 && <Empty title="No wallets on this page yet">The list fills in as the page loads.</Empty>}
          {list.length > 0 && shown.length === 0 && <Empty title="Nothing matches">Try another name, or clear the filter.</Empty>}

          {GROUPS.map(([g, title]) => {
            const rows = shown.filter((d) => groupOf(d) === g);
            if (!rows.length) return null;
            return (
              <section key={g} aria-label={title}>
                <div className="group-head"><h2>{title} · {rows.length}</h2></div>
                {rows.map((d) => {
                  const top = d.labels[0];
                  const mine = d.labels.some((l) => l.source === "private");
                  const tag = () => onTag({ address: d.raw, kind: d.kind as Target["kind"], existing: d.labels.find((l) => l.source === "private") ?? null });
                  return (
                    <WalletItem key={d.normalized} tone={g} defaultOpen={g === "flagged"}
                      title={rowTitle(top) ?? truncateAddress(d.raw)}
                      sub={top ? `${truncateAddress(d.raw)} · ${chainName(d.chain)}` : chainName(d.chain)}
                      pill={top?.source === "verified" ? <span className="pill good">✓ Verified</span> : top?.shared ? <span className="pill warn">Shared</span> : <StatusPill status={top?.status} />}
                      // An untagged address keeps Tag on the row: it's the one thing you'd do with it.
                      quick={!top && taggable(d.kind) ? <button type="button" className="btn sm primary press" aria-label={`Tag ${truncateAddress(d.raw)}`} onClick={tag}>Tag</button> : undefined}>
                      <Labels tags={top?.tags} />
                      <div className="acts">
                        <button type="button" className="btn sm press" onClick={() => void locate(d)}><Icon name="target" size={14} />Find</button>
                        {taggable(d.kind) && top && <button type="button" className="btn sm press" onClick={tag}><Icon name="tag" size={14} />{mine ? "Edit" : "Add my tag"}</button>}
                        {taggable(d.kind) && <button type="button" className="btn sm ghost press" onClick={() => nav.go({ view: "wallet", address: d.raw, kind: d.kind as Target["kind"] })}><Icon name="chevronRight" size={14} />Details</button>}
                        <CopyButton text={d.raw} />
                      </div>
                    </WalletItem>
                  );
                })}
              </section>
            );
          })}

          {untagged.length > 1 && (
            <div style={{ marginTop: 14 }}>
              <button type="button" className="btn sm ghost press" onClick={async () => {
                await navigator.clipboard.writeText(untagged.map((d) => d.raw).join("\n")).catch(() => {});
                toast(`${untagged.length} addresses copied. In the dashboard, open a list and use More › Import.`);
              }}><Icon name="copy" size={14} />Copy {untagged.length} untagged addresses</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
