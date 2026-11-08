"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { parsePastedAddress, truncateAddress } from "@tagawallet/shared";
import { fetcher } from "@/lib/client";
import { useOpenWallet } from "./wallet-drawer";
import { useCreate } from "./collections";

type Item = { id: string; group: string; label: string; hint?: string; run: () => void };

/** ⌘K from anywhere: find a person, project, wallet or list, or start something new. */
export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { addWallet, newList } = useCreate();
  const router = useRouter();
  const openWallet = useOpenWallet();
  const ref = useRef<HTMLDialogElement>(null);
  const [q, setQ] = useState(""), [debounced, setDebounced] = useState(""), [index, setIndex] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); onOpenChange(!open); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);
  useEffect(() => {
    const d = ref.current;
    if (open && d && !d.open) { setQ(""); setIndex(0); d.showModal(); }
    if (!open && d?.open) d.close();
  }, [open]);
  useEffect(() => { const t = setTimeout(() => setDebounced(q.trim()), 120); return () => clearTimeout(t); }, [q]);

  const { data } = useSWR(open && debounced ? `/api/search?q=${encodeURIComponent(debounced)}` : null, fetcher, { keepPreviousData: true });
  const { data: lists } = useSWR<any[]>(open ? "/api/lists" : null, fetcher);

  const go = (fn: () => void) => () => { onOpenChange(false); fn(); };
  const parsed = parsePastedAddress(q);
  const address = parsed && parsed.kind !== "ens" && parsed.kind !== "sns" ? parsed : null;
  const term = q.trim().toLowerCase();
  const items: Item[] = [];
  if (address && !data?.wallets?.some((w: any) => w.normalizedAddress === address.normalized)) {
    items.push({ id: "add", group: "Add", label: `Add ${truncateAddress(address.raw)}`, hint: "New wallet", run: go(() => addWallet({ address: address.raw })) });
  }
  if (term) {
    for (const e of data?.entities?.slice(0, 6) ?? []) {
      items.push({ id: `e${e.id}`, group: "Contacts", label: e.name, hint: e.type === "individual" ? "Person" : "Project", run: go(() => router.push(`/entities/${e.id}`)) });
    }
    for (const w of data?.wallets?.slice(0, 5) ?? []) {
      items.push({ id: `w${w.id}`, group: "Wallets", label: w.displayLabel || "Unnamed wallet", hint: truncateAddress(w.address), run: go(() => openWallet(w.id)) });
    }
    for (const l of lists?.filter((l) => l.name.toLowerCase().includes(term)).slice(0, 4) ?? []) {
      items.push({ id: `l${l.id}`, group: "Lists", label: l.name, hint: `${l.walletCount} wallets`, run: go(() => router.push(`/lists/${l.id}`)) });
    }
  }
  const actions: Item[] = [
    { id: "a-home", group: "Go to", label: "Home", run: go(() => router.push("/dashboard")) },
    { id: "a-settings", group: "Go to", label: "Settings", run: go(() => router.push("/settings")) },
    { id: "a-person", group: "Create", label: "New person", run: go(() => newList("person")) },
    { id: "a-project", group: "Create", label: "New project", run: go(() => newList("project")) },
    { id: "a-wallet", group: "Create", label: "Add a wallet", run: go(() => addWallet()) },
    { id: "a-list", group: "Create", label: "New list", run: go(() => newList("list")) },
  ];
  items.push(...actions.filter((a) => !term || a.label.toLowerCase().includes(term)));
  const active = Math.min(index, Math.max(items.length - 1, 0));

  return (
    <dialog ref={ref} onClose={() => onOpenChange(false)} aria-label="Search"
      className="mx-auto mt-[12vh] w-[min(36rem,calc(100vw-2rem))] overflow-hidden rounded-2xl bg-card p-0 text-ink shadow-2xl">
      {open && (
        <div>
          <input
            autoFocus value={q} aria-label="Search everything" placeholder="Search people, wallets and lists, or paste an address"
            onChange={(e) => { setQ(e.target.value); setIndex(0); }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setIndex((i) => Math.min(i + 1, items.length - 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setIndex((i) => Math.max(i - 1, 0)); }
              if (e.key === "Enter") { e.preventDefault(); items[active]?.run(); }
            }}
            className="w-full border-b border-line bg-transparent px-4 py-3.5 text-base outline-none placeholder:text-muted/70"
          />
          <ul role="listbox" aria-label="Results" className="max-h-[50vh] overflow-y-auto p-1.5">
            {items.map((it, i) => (
              <li key={it.id}>
                {(i === 0 || items[i - 1]!.group !== it.group) && <div className="px-2.5 pt-2 pb-1 text-xs font-medium text-muted">{it.group}</div>}
                <button role="option" aria-selected={i === active} onMouseEnter={() => setIndex(i)} onClick={it.run}
                  className={`flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-2 text-left text-sm ${i === active ? "bg-wash" : ""}`}>
                  <span className="truncate">{it.label}</span>
                  {it.hint && <span className="shrink-0 text-xs text-muted">{it.hint}</span>}
                </button>
              </li>
            ))}
            {term && !items.length && <li className="px-3 py-6 text-center text-sm text-muted">No matches</li>}
          </ul>
          <div className="flex gap-4 border-t border-line px-4 py-2 text-xs text-muted"><span>↑↓ to move</span><span>↵ to open</span><span>esc to close</span></div>
        </div>
      )}
    </dialog>
  );
}
