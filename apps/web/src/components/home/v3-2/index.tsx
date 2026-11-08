"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/client";
import { Button } from "@/components/ui";
import { KindIcon, kindLabel, useCollections, useCreate, type Collection, type Kind } from "@/components/collections";
import { GettingStarted, initials } from "../shared";
import { SelectMenu } from "./select-menu";
import { WalletTable } from "./wallet-table";
import { FloatingWalletPanel, StepBar, WalletDetails } from "./wallet-panel";
import { FadeText, hit, Icon, press } from "./ui";
import { ScopeActions } from "./scope";
import { NewAddress } from "./address";

/** What the table shows: everything, the unfiled pile, or one contact or list. */
type Pick = { kind: "all" } | { kind: "unfiled" } | { kind: Kind; id: string };
const parsePick = (v: string | null): Pick => {
  if (v === "unfiled") return { kind: "unfiled" };
  const [kind, id] = (v ?? "").split(":");
  return (kind === "person" || kind === "project" || kind === "list") && id ? { kind, id } : { kind: "all" };
};
const pickKey = (p: Pick) => ("id" in p ? `${p.kind}:${p.id}` : p.kind);
const GROUP_PREVIEW = 8;

function Avatar({ c }: { c: Collection }) {
  if (c.kind === "list") return <KindIcon kind="list" className="size-4 shrink-0 text-muted" />;
  return c.avatarUrl
    ? <img src={c.avatarUrl} alt="" className="size-5 shrink-0 rounded-full object-cover outline outline-1 -outline-offset-1 outline-black/10" />
    : <span aria-hidden className="grid size-5 shrink-0 place-items-center rounded-full bg-wash text-[9px] font-semibold text-muted">{initials(c.name)}</span>;
}

function Item({ on, onClick, icon, label, count, sub }: { on: boolean; onClick: () => void; icon: React.ReactNode; label: string; count?: number; sub?: string }) {
  return (
    <li>
      <button onClick={onClick} aria-current={on ? "true" : undefined}
        className={`flex min-h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-sm pointer-coarse:min-h-11 ${press} ${on ? "bg-card font-medium shadow-sm" : "text-ink/85 hover:bg-card/60"}`}>
        {icon}
        <FadeText className="min-w-0 flex-1">{label}{sub && <span className="ml-1 text-xs font-normal text-muted">{sub}</span>}</FadeText>
        {count != null && <span className="text-xs tabular-nums text-muted">{count}</span>}
      </button>
    </li>
  );
}

/** Where each contact or list stands: public, verified, shared. */
const sideNote = (c: Collection) => {
  if (c.kind === "list") return [c.isPublic && "◎ public", c.shared && "⇄ shared"].filter(Boolean).join(" ") || undefined;
  if (!c.isPublic) return undefined;
  return c.verified ? "✓ public" : "◎ public";
};

function Group({ title, items, pick, onPick, onNew, newLabel, searching }: {
  title: string; items: Collection[]; pick: Pick; onPick: (p: Pick) => void; onNew: () => void; newLabel: string; searching: boolean;
}) {
  const [all, setAll] = useState(false);
  const shown = all || searching ? items : items.slice(0, GROUP_PREVIEW);
  return (
    <div>
      <div className="flex items-center justify-between pt-5 pr-2.5 pb-1 pl-2.5">
        <h2 className="text-xs font-medium text-muted">{title}</h2>
        <button aria-label={newLabel} title={newLabel} className={`grid size-7 place-items-center rounded-md text-muted hover:bg-card hover:text-ink ${press} ${hit}`} onClick={onNew}><Icon name="plus" className="size-3.5" /></button>
      </div>
      <ul className="space-y-0.5">
        {shown.map((c) => (
          <Item key={c.id} on={"id" in pick && pick.id === c.id} onClick={() => onPick({ kind: c.kind, id: c.id })}
            icon={<Avatar c={c} />} label={c.name} count={c.count} sub={sideNote(c)} />
        ))}
        {!items.length && <li className="px-2.5 py-1 text-xs text-muted">{searching ? "No matches" : "None yet"}</li>}
      </ul>
      {!searching && items.length > GROUP_PREVIEW && (
        <button className={`min-h-9 px-2.5 text-xs text-muted hover:text-ink ${press}`} onClick={() => setAll((v) => !v)}>{all ? "Show less" : `Show ${items.length - GROUP_PREVIEW} more`}</button>
      )}
    </div>
  );
}

/** How a wallet opens; chosen in Settings → Display and saved to the account. */
type OpenMode = "peek" | "inline" | "page";

/**
 * v3.2 Directory: one search bar that narrows both the directory and the table,
 * a paginated wallet table, compact filter menus, and a floating wallet panel.
 */
export function HomeV32() {
  const router = useRouter(), path = usePathname(), params = useSearchParams();
  // Older links: ?unfiled=1 (or ?unlinked=1) opens the unfiled pile.
  const legacyUnfiled = ["1", "true"].includes(params.get("unfiled") ?? "") || ["1", "true"].includes(params.get("unlinked") ?? "");
  const pick = parsePick(params.get("in") ?? (legacyUnfiled ? "unfiled" : null));
  // Which wallet is open lives in the URL (?wp=) for links and Back, mirrored locally so the
  // list ↔ page switch can happen inside a view transition (the URL catches up right after).
  const urlOpen = params.get("wp");
  const [panel, setPanel] = useState<string | null>(urlOpen);
  useEffect(() => { setPanel(urlOpen); }, [urlOpen]);
  // Page mode: whether you just came back from a wallet (the list slides in from the left), and where you were.
  const listScroll = useRef(0);
  const sectionRef = useRef<HTMLElement>(null);
  const modeRef = useRef<OpenMode>("peek");
  const { all } = useCollections();
  const { newList, addWallet } = useCreate();
  const { data } = useSWR("/api/dashboard", fetcher);
  // ?q= (old search links, /search) starts the search; ?add=<address> opens the add dialog for it.
  const [q, setQ] = useState(() => params.get("q") ?? "");
  const searchRef = useRef<HTMLInputElement>(null);
  const added = params.get("add");
  useEffect(() => {
    if (!added) return;
    addWallet({ address: added });
    setParams((n) => n.delete("add"));
  }, [added]); // eslint-disable-line react-hooks/exhaustive-deps
  const [rowsInfo, setRowsInfo] = useState<{ id: string; name: string }[]>([]);
  const ids = rowsInfo.map((x) => x.id);
  // A pasted address the search found nothing for: Add wallet saves exactly that.
  const [newAddress, setNewAddress] = useState<string | null>(null);
  const { data: session } = useSWR("/api/auth/session", fetcher);
  const mode: OpenMode = session?.user?.walletOpen ?? "peek";
  modeRef.current = mode;

  const setParams = useCallback((edit: (p: URLSearchParams) => void, push = false) => {
    const next = new URLSearchParams(params.toString());
    edit(next);
    const qs = next.toString();
    router[push ? "push" : "replace"](`${path}${qs ? `?${qs}` : ""}`, { scroll: false });
  }, [params, path, router]);
  const go = (p: Pick) => { setQ(""); setParams((n) => { for (const k of ["in", "wp", "unfiled", "unlinked", "q"]) n.delete(k); if (p.kind !== "all") n.set("in", pickKey(p)); }); };
  const goScope = (t: { kind: Kind; id: string } | null) => go(t ?? { kind: "all" });
  const openPanel = useCallback((id: string | null) => {
    if (modeRef.current === "page" && !!panel !== !!id) {
      if (id) {
        // Into a wallet: remember where the list was, and bring the top of the page into view if you'd scrolled past it.
        listScroll.current = window.scrollY;
        requestAnimationFrame(() => {
          const top = (sectionRef.current?.getBoundingClientRect().top ?? 0) + window.scrollY - 88;
          if (window.scrollY > top) window.scrollTo({ top });
        });
      } else {
        requestAnimationFrame(() => window.scrollTo({ top: listScroll.current }));
      }
    }
    setPanel(id);
    setParams((n) => { if (id) n.set("wp", id); else n.delete("wp"); });
  }, [setParams, panel]);

  // Links from ⌘K and elsewhere use ?w= (the modal drawer). Here, open them in the floating panel instead.
  const w = params.get("w");
  useEffect(() => { if (w) setParams((n) => { n.delete("w"); n.set("wp", w); }); }, [w]); // eslint-disable-line react-hooks/exhaustive-deps

  const needle = q.trim().toLowerCase();
  const isAddressish = /^0x|^[1-9A-HJ-NP-Za-km-z]{32,}$/.test(q.trim());
  const searchingDir = !!needle && !isAddressish;
  const visible = all.filter((c) => !searchingDir || c.name.toLowerCase().includes(needle) || c.tags.some((t) => t.toLowerCase().includes(needle)));
  const contacts = visible.filter((c) => c.kind !== "list");
  const lists = visible.filter((c) => c.kind === "list");
  const chosen = "id" in pick ? all.find((c) => c.id === pick.id) : undefined;
  const scope = chosen ? { kind: chosen.kind, id: chosen.id, name: chosen.name } : undefined;
  const title = chosen ? chosen.name : pick.kind === "unfiled" ? "Unfiled" : "All wallets";
  const paging = mode === "page" && !!panel;
  const { data: openWallet } = useSWR(paging ? `/api/wallets/${panel}` : null, fetcher);
  // The row already knows the name, so the title is right the moment the page appears.
  const openName = openWallet?.displayLabel ?? rowsInfo.find((x) => x.id === panel)?.name;

  // On phones the directory folds into one picker above the table.
  const pickerOptions = [
    { value: "all", label: "All wallets", hint: String(data?.counts?.wallets ?? "") },
    { value: "unfiled", label: "Unfiled", hint: String(data?.counts?.unfiled ?? "") },
    ...all.map((c) => ({ value: `${c.kind}:${c.id}`, label: c.name, hint: kindLabel(c.kind) })),
  ];

  return (
    <div className="space-y-4">
      <GettingStarted />

      <div className="flex gap-3">
        <div className="relative min-w-0 flex-1">
          <Icon name="search" className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
          <input ref={searchRef} type="search" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search or add"
            placeholder={scope ? `Search ${scope.name}, or paste an address to add it here` : "Search contacts, lists and wallets, or paste an address"}
            className="h-11 w-full rounded-xl border border-transparent bg-card pr-3 pl-10 text-sm placeholder:text-muted focus:border-accent" />
        </div>
        <Button variant="primary" className={`h-11 shrink-0 rounded-xl ${press}`} title={newAddress ? `Add ${newAddress}` : undefined}
          onClick={() => addWallet({ ...(newAddress ? { address: newAddress } : {}), ...(scope ? { into: scope } : {}) })}>
          Add wallet{scope ? " here" : ""}
        </Button>
      </div>

      {/* The layout never changes when a wallet opens: the sidebar stays, whichever way it opens. */}
      <div className="grid gap-5 md:grid-cols-[14rem_minmax(0,1fr)]">
        <aside aria-label="Directory" className="scroll-fade-y hidden overflow-x-hidden pb-4 md:sticky md:top-20 md:block md:max-h-[calc(100dvh-6rem)] md:self-start md:overflow-y-auto">
          <ul className="space-y-0.5">
            <Item on={pick.kind === "all"} onClick={() => go({ kind: "all" })} icon={<span aria-hidden className="w-4 text-center font-mono text-[10px] text-muted">0x</span>} label="All wallets" count={data?.counts?.wallets} />
            <Item on={pick.kind === "unfiled"} onClick={() => go({ kind: "unfiled" })} icon={<span aria-hidden className="w-4 text-center text-muted">○</span>} label="Unfiled" count={data?.counts?.unfiled} />
          </ul>
          <Group title="Contacts" items={contacts} pick={pick} onPick={go} onNew={() => newList("person")} newLabel="New contact" searching={searchingDir} />
          <Group title="Lists" items={lists} pick={pick} onPick={go} onNew={() => newList("list")} newLabel="New list" searching={searchingDir} />
        </aside>

        <section ref={sectionRef} aria-label="Wallets" className="min-w-0 space-y-3">
          <div className="md:hidden">
            <SelectMenu label="Viewing" value={pickKey(pick)} options={pickerOptions} searchable onChange={(v) => go(parsePick(v))}
              buttonClass="inline-flex h-11 w-full items-center justify-between gap-2 rounded-xl bg-card px-3.5 text-sm font-medium" />
          </div>
          {/* One header for both list and wallet page: the title sits in the same place and its text just changes. */}
          <header className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
            {/* The header never animates: its text simply changes. Only the content below transitions. */}
            <div className="min-w-0">
              <h1 className="line-clamp-2 text-2xl leading-[1.1] font-semibold tracking-tight text-balance">
                {paging ? openName || "Unnamed wallet" : title}
              </h1>
              {paging ? (
                // A block-level line exactly as tall as the subtitle it replaces (h-5), starting at the same x, so nothing below moves.
                <button onClick={() => openPanel(null)} className={`mt-1 flex h-5 w-fit items-center gap-0.5 text-sm leading-5 text-muted hover:text-ink ${press}`}>
                  <Icon name="chevronLeft" className="size-3.5" />Back to {title}
                </button>
              ) : (
              <p className="mt-1 min-h-5 text-sm leading-5 text-pretty text-muted">
                {chosen ? <>{kindLabel(chosen.kind)} · {chosen.count} wallet{chosen.count === 1 ? "" : "s"}{chosen.kind === "list" ? (chosen.shared ? " · Shared" : " · Only you") : chosen.isPublic ? (chosen.verified ? " · ✓ Public" : " · Public") : " · Private"}</>
                  : pick.kind === "unfiled" ? "Not on a contact or in a list yet. Open one to file it."
                    : "Every address you've named."}
              </p>
              )}
            </div>
            <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
              {/* Kept in place (just hidden) on the wallet view, and no taller than the switch, so the header never changes height. */}
              {chosen && <ScopeActions key={chosen.id} c={chosen} go={goScope} hidden={paging} />}
            </span>
          </header>

          {/* The table component stays mounted in page modes (its filters and page survive); the wallet shows in its content slot. */}
          <div className="space-y-3">
          <WalletTable key={pickKey(pick)} scope={scope} unfiled={pick.kind === "unfiled"} q={q} canEdit={chosen ? chosen.canEdit : true}
            openId={panel} onOpen={(id) => openPanel(panel === id && mode === "inline" ? null : id)} onRows={setRowsInfo} onNewAddress={setNewAddress} prefetch={mode !== "inline"}
            transition={mode === "page" ? "morph" : undefined}
            renderNewAddress={(a) => <NewAddress address={a} into={scope} />} rowHints
            pageView={paging ? {
              key: panel!,
              // Same height and place as the filter row it stands in for.
              bar: <StepBar id={panel!} ids={ids} onOpen={openPanel} onClose={() => openPanel(null)} />,
              content: (
                <article aria-label="Wallet" className="overflow-hidden rounded-2xl bg-card">
                  <WalletDetails key={panel} id={panel!} wide onClose={() => openPanel(null)} />
                </article>
              ),
            } : null}
            renderExpanded={mode === "inline" ? (id) => (
              <div className="border-y border-line">
                <div className="px-3 pt-2"><StepBar id={id} ids={ids} onOpen={openPanel} onClose={() => openPanel(null)} /></div>
                <WalletDetails key={id} id={id} wide onClose={() => openPanel(null)} />
              </div>
            ) : undefined} />
          </div>
        </section>
      </div>

      {panel && mode === "peek" && <FloatingWalletPanel id={panel} ids={ids} onOpen={openPanel} onClose={() => openPanel(null)} />}
    </div>
  );
}
