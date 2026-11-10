"use client"
import Link from "next/link"
import { useEffect, useId, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react"
import { BrandMark } from "@/components/brand-mark"
import { Logo } from "@/components/ui"

/* A tiny internet with TagAWallet installed the way it works today: chips beside
   addresses, a glance card on click, and tagging in the floating panel. */

type Site = "scan" | "x" | "swap" | "vault" | "welcome"
type Tone = "yours" | "shared" | "verified"
type Tag = { name: string; source: string; tone: Tone; who?: string }
type Overlay = null | { kind: "card"; address: string } | { kind: "panel"; address?: string; mode: "page" | "tag" }

const SITES: { id: Site; title: string; url: string; fav: string }[] = [
  { id: "scan", title: "Etherscan", url: "etherscan.io/txs", fav: "#21325b" },
  { id: "x", title: "X", url: "x.com/home", fav: "#0f1419" },
  { id: "swap", title: "Uniswap", url: "app.uniswap.org/#/swap", fav: "#fc72ff" },
  { id: "vault", title: "DeBank", url: "debank.com/profile/0x4c1f…c2a9", fav: "#ff6933" },
]

const MYSTERY = "0x4c1f8a2e…c2a9"
const FULL = {
  [MYSTERY]: "0x4c1f8a2e91b7d04c6a88f0e3b2d9c5a1c2a9",
  "0xb71a…40ce": "0xb71a4d2f8c91e0a6b3d5f7a9c1e2b40ce",
  "0x9e0b…77d1": "0x9e0b3c8a1f6d2e4b7a0c5d8f1e3a77d1",
  "0x72ca…1e06": "0x72ca9f1d4e8b2a6c0d3f7e1b5a91e06",
  "0x03fd…a98b": "0x03fd6a8c2e1b9d4f7a0c3e5b8d1a98b",
} as const

const STARTING: Record<string, Tag> = {
  "0xb71a…40ce": { name: "Binance: Hot Wallet", source: "Verified", tone: "verified" },
  "0x9e0b…77d1": { name: "Research DAO", source: "Shared list", tone: "shared", who: "Research DAO" },
}

const QUEST = [
  "Tag the mystery wallet on Etherscan",
  "See the name show up on X",
  "See it on Uniswap",
  "See it in DeBank",
]

/* Same tokens the extension paints into its chip/card shadow roots. */
const LIGHT = {
  bg: "#fffefb", fg: "#1a1a18", muted: "#6a675e", line: "#dfdbcf", wash: "#efece2",
  accent: "#c8421b", accentInk: "#ffffff", good: "#1b7a4a", warn: "#9a6a00", bad: "#b3261e",
  paper: "#f6f4ee", raised: "#ffffff",
} as const
const DARK = {
  bg: "#1c1c19", fg: "#efece3", muted: "#9c988b", line: "#33322c", wash: "#25241f",
  accent: "#ee6a42", accentInk: "#1a0d07", good: "#55c58d", warn: "#dbab45", bad: "#f2837b",
  paper: "#141412", raised: "#2a2924",
} as const
type Appearance = "light" | "dark"
const PALETTE = { light: LIGHT, dark: DARK }
const SITE_APPEARANCE: Record<Site, Appearance> = { scan: "light", x: "dark", swap: "dark", vault: "light", welcome: "light" }

/** Force light product tokens — including Tailwind's --color-* aliases — so OS dark mode can't bleach the shell. */
export const SHELL: CSSProperties = {
  colorScheme: "light",
  background: LIGHT.paper,
  color: LIGHT.fg,
  ["--paper" as string]: LIGHT.paper,
  ["--card" as string]: LIGHT.bg,
  ["--ink" as string]: LIGHT.fg,
  ["--muted" as string]: LIGHT.muted,
  ["--line" as string]: LIGHT.line,
  ["--accent" as string]: LIGHT.accent,
  ["--accent-ink" as string]: LIGHT.accentInk,
  ["--wash" as string]: LIGHT.wash,
  ["--good" as string]: LIGHT.good,
  ["--warn" as string]: LIGHT.warn,
  ["--bad" as string]: LIGHT.bad,
  ["--color-paper" as string]: LIGHT.paper,
  ["--color-card" as string]: LIGHT.bg,
  ["--color-ink" as string]: LIGHT.fg,
  ["--color-muted" as string]: LIGHT.muted,
  ["--color-line" as string]: LIGHT.line,
  ["--color-accent" as string]: LIGHT.accent,
  ["--color-accent-ink" as string]: LIGHT.accentInk,
  ["--color-wash" as string]: LIGHT.wash,
  ["--color-good" as string]: LIGHT.good,
  ["--color-warn" as string]: LIGHT.warn,
  ["--color-bad" as string]: LIGHT.bad,
}

function TagIcon ({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M3 4.5A1.5 1.5 0 0 1 4.5 3h7.4c.4 0 .8.16 1.06.44l7.6 7.6a1.5 1.5 0 0 1 0 2.12l-7.4 7.4a1.5 1.5 0 0 1-2.12 0l-7.6-7.6A1.5 1.5 0 0 1 3 11.9V4.5Z" />
    </svg>
  )
}

function Icon ({ d, size = 14 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {d.split("|").map((p) => <path key={p} d={p} />)}
    </svg>
  )
}

const I = {
  x: "m4.5 4.5 7 7m0-7-7 7",
  tag: "M2.75 3.5a.75.75 0 0 1 .75-.75h4.1l5.65 5.65a.75.75 0 0 1 0 1.06l-3.6 3.6a.75.75 0 0 1-1.06 0L2.94 7.41a.75.75 0 0 1-.19-.5Z",
  search: "M7 7m-4.25 0a4.25 4.25 0 1 0 8.5 0a4.25 4.25 0 1 0-8.5 0|m10.25 10.25 3 3",
}

function initials (name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?"
}

function AddressChip ({
  address,
  tag,
  showing,
  appearance,
  highlight,
  pulse,
  onOpen,
}: {
  address: string
  tag?: Tag
  showing: boolean
  appearance: Appearance
  highlight?: boolean
  pulse?: boolean
  onOpen: (address: string) => void
}) {
  const c = PALETTE[appearance]
  // Untagged addresses keep the host site's link colour when the extension is off.
  if (!showing) {
    const link = appearance === "dark" ? "#1d9bf0" : "#0784c3"
    return <span className="font-mono text-[.92em]" style={{ color: link }}>{address}</span>
  }
  const border = tag?.tone === "verified"
    ? c.good
    : tag?.tone === "shared"
      ? `color-mix(in srgb, ${c.warn} 55%, ${c.line})`
      : c.line
  const color = tag?.tone === "verified" ? c.good : tag?.tone === "shared" ? c.warn : c.fg
  return (
    <span className="inline-flex items-center gap-1 align-middle">
      <span className="font-mono text-[.92em]">{address}</span>
      {tag
        ? (
          <button
            type="button"
            title={`${tag.name} · ${tag.source}`}
            aria-label={`TagAWallet: ${tag.name}. ${tag.source}`}
            onClick={() => onOpen(address)}
            className="inline-flex h-[18px] max-w-[11rem] items-center rounded px-1.5 text-[11px] font-medium leading-none"
            style={{
              background: c.bg,
              color,
              border: `1px solid ${border}`,
              boxShadow: highlight ? `0 0 0 2px color-mix(in srgb, ${c.accent} 30%, transparent)` : undefined,
            }}
          >
            <span className="truncate">{tag.tone === "verified" ? `✓ ${tag.name}` : tag.name}</span>
          </button>
          )
        : (
          <button
            type="button"
            title="Not tagged yet. Click to tag it."
            aria-label="Tag this wallet"
            onClick={() => onOpen(address)}
            className={`inline-grid size-[18px] place-items-center rounded opacity-75 hover:opacity-100 ${pulse ? "pulse-tag" : ""}`}
            style={{
              background: c.bg,
              color: pulse ? c.accent : c.muted,
              border: `1px dashed ${pulse ? c.accent : c.line}`,
            }}
          >
            <TagIcon />
          </button>
          )}
    </span>
  )
}

export function SurfBrowser ({ signedIn, className = "" }: { signedIn: boolean; className?: string }) {
  const [tabs] = useState<Site[]>(["scan", "x", "swap", "vault"])
  const [site, setSite] = useState<Site>("scan")
  const [history, setHistory] = useState<Site[]>(["scan"])
  const [tags, setTags] = useState(STARTING)
  const [enabled, setEnabled] = useState(true)
  const [overlay, setOverlay] = useState<Overlay>(null)
  const [done, setDone] = useState<boolean[]>([false, false, false, false])
  const [who, setWho] = useState("Mina")
  const [label, setLabel] = useState("Mina")
  const [status, setStatus] = useState<"none" | "mine" | "trusted" | "watchlist">("mine")
  const formId = useId()
  const nameRef = useRef<HTMLInputElement>(null)
  const tagged = !!tags[MYSTERY]
  const count = done.filter(Boolean).length
  const showing = enabled && site !== "welcome"

  const mark = (i: number) => setDone((d) => {
    if (d[i]) return d
    const next = d.map((v, k) => (k === i ? true : v))
    if (next.every(Boolean)) setTimeout(() => go("welcome"), 700)
    return next
  })

  const go = (s: Site) => {
    setSite(s)
    setHistory((h) => (h[h.length - 1] === s ? h : [...h, s]))
    setOverlay(null)
    if (tagged && s === "x") mark(1)
    if (tagged && s === "swap") mark(2)
    if (tagged && s === "vault") mark(3)
  }

  const back = () => {
    if (history.length < 2) return
    const h = history.slice(0, -1)
    setHistory(h)
    setSite(h[h.length - 1]!)
    setOverlay(null)
  }

  const openCard = (address: string) => setOverlay({ kind: "card", address })
  const openPanel = (mode: "page" | "tag", address?: string) => {
    if (mode === "tag" && address) {
      const existing = tags[address]
      setWho(existing?.who || existing?.name || (address === MYSTERY ? "Mina" : ""))
      setLabel(existing?.name || (address === MYSTERY ? "Mina" : ""))
      setStatus(existing?.tone === "yours" ? "mine" : "none")
    }
    setOverlay({ kind: "panel", mode, address })
  }

  useEffect(() => {
    if (overlay?.kind === "panel" && overlay.mode === "tag") nameRef.current?.focus()
  }, [overlay])

  const saveTag = (e: FormEvent) => {
    e.preventDefault()
    if (overlay?.kind !== "panel" || !overlay.address) return
    const name = label.trim().slice(0, 40) || who.trim().slice(0, 40) || "My tag"
    const person = who.trim().slice(0, 40) || name
    setTags((t) => ({
      ...t,
      [overlay.address!]: { name, who: person, source: "Your tag", tone: "yours" },
    }))
    if (overlay.address === MYSTERY) mark(0)
    setOverlay({ kind: "panel", mode: "page" })
  }

  const pageAddresses = (() => {
    if (site === "scan") return [MYSTERY, "0xb71a…40ce", "0x9e0b…77d1", "0x72ca…1e06", "0x03fd…a98b"]
    if (site === "x") return [MYSTERY, "0xb71a…40ce", "0x9e0b…77d1"]
    if (site === "swap") return [MYSTERY, "0x72ca…1e06", "0xb71a…40ce", "0x03fd…a98b"]
    if (site === "vault") return [MYSTERY, "0xb71a…40ce"]
    return []
  })()

  const appearance = SITE_APPEARANCE[site]
  const theme = PALETTE[appearance]

  const chip = (address: string) => (
    <AddressChip
      address={address}
      tag={tags[address]}
      showing={showing}
      appearance={appearance}
      highlight={address === MYSTERY && done[0]}
      pulse={address === MYSTERY && !tagged}
      onOpen={openCard}
    />
  )

  const current = SITES.find((s) => s.id === site)
  const hint = !done[0]
    ? "Someone just moved 88 ETH. Click the pulsing tag next to the mystery wallet."
    : !done[1]
      ? "Your tag is saved. Open X — the name is already there."
      : !done[2]
        ? "Same wallet on Uniswap. Switch tabs."
        : !done[3]
          ? "One more: check DeBank."
          : "One tag. Four sites. That’s the product."

  return (
    <div className={`relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-black/10 bg-[#dee1e6] shadow-[0_24px_80px_-24px_rgba(0,0,0,.45)] ${className}`}>
        {/* Chrome tabs */}
        <div role="tablist" aria-label="Open sites" className="flex shrink-0 items-end gap-px overflow-x-auto bg-[#dee1e6] px-2 pt-2">
          {tabs.map((id) => {
            const s = SITES.find((x) => x.id === id)!
            const on = site === id
            return (
              <button
                key={id}
                role="tab"
                type="button"
                aria-selected={on}
                onClick={() => go(id)}
                className={`flex max-w-[11rem] shrink-0 items-center gap-2 rounded-t-lg px-3 py-1.5 text-sm ${on ? "bg-white font-medium text-ink shadow-[0_-1px_0_#fff]" : "text-[#444] hover:bg-black/5"}`}
              >
                <span aria-hidden className="size-3 shrink-0 rounded-sm" style={{ background: s.fav }} />
                <span className="truncate">{s.title}</span>
              </button>
            )
          })}
          {count === QUEST.length && (
            <button
              role="tab"
              type="button"
              aria-selected={site === "welcome"}
              onClick={() => go("welcome")}
              className={`ml-1 flex shrink-0 items-center gap-2 rounded-t-lg px-3 py-1.5 text-sm ${site === "welcome" ? "bg-white font-medium text-accent" : "text-accent hover:bg-black/5"}`}
            >
              <BrandMark size={12} /> Welcome
            </button>
          )}
        </div>

        {/* Omnibox + extension */}
        <div className="relative z-20 flex shrink-0 items-center gap-1.5 border-b border-black/8 bg-white px-2 py-1.5 md:px-3">
          <button type="button" aria-label="Back" onClick={back} disabled={history.length < 2} className="grid size-7 place-items-center rounded-full text-[#5f6368] hover:bg-[#f1f3f4] disabled:opacity-35">←</button>
          <button type="button" aria-label="Reload" className="grid size-7 place-items-center rounded-full text-[#5f6368] hover:bg-[#f1f3f4]">↻</button>
          <p className="flex min-w-0 flex-1 items-center gap-2 truncate rounded-full bg-[#f1f3f4] px-3 py-1.5 font-mono text-xs text-[#3c4043]">
            <span aria-hidden className="grid size-3.5 place-items-center rounded-full bg-[#34a853]/15 text-[9px] text-[#34a853]">🔒</span>
            <span className="truncate">{current?.url ?? "tagawallet.com/welcome"}</span>
          </p>
          <div className="relative">
            <button
              type="button"
              aria-label="TagAWallet extension"
              aria-expanded={overlay?.kind === "panel"}
              onClick={() => setOverlay(overlay?.kind === "panel" ? null : { kind: "panel", mode: "page" })}
              className={`relative grid size-8 place-items-center rounded-full hover:bg-[#f1f3f4] ${enabled ? "" : "opacity-40 grayscale"}`}
            >
              <BrandMark size={18} />
              <span aria-hidden className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-accent px-1 text-center text-[10px] font-semibold leading-4 text-accent-ink">
                {Object.keys(tags).length}
              </span>
            </button>
          </div>
          <span aria-hidden className="ml-1 hidden size-7 rounded-full bg-[#e8eaed] sm:block" />
        </div>

        {/* Page content */}
        <div className="relative min-h-0 flex-1 overflow-y-auto bg-white" onClick={() => overlay?.kind === "card" && setOverlay(null)}>
          {site === "scan" && <ScanSite chip={chip} />}
          {site === "x" && <XSite chip={chip} />}
          {site === "swap" && <SwapSite chip={chip} />}
          {site === "vault" && <VaultSite chip={chip} />}
          {site === "welcome" && (
            <div className="pop flex min-h-full flex-col items-center justify-center p-6 text-center">
              <BrandMark size={88} />
              <h2 className="mt-5 text-[clamp(2rem,5.5vw,3.75rem)] font-semibold leading-[1.05] tracking-tight">One name. Every site.</h2>
              <p className="mt-3 max-w-lg text-muted md:text-lg">
                You tagged a wallet once and it followed you from the explorer to X, Uniswap and DeBank. The real extension works the same way in Chrome, Brave and Edge.
              </p>
              <Link href={signedIn ? "/dashboard" : "/signup"} className="mt-6 inline-flex items-center gap-2 rounded-md bg-accent px-5 py-3 font-medium text-accent-ink">
                {signedIn ? "Open dashboard" : "Start tagging, it's free"}
                <span className="cta-arrow" aria-hidden>→</span>
              </Link>
              <p className="mt-6 flex gap-4 text-sm text-muted">
                <span>© {new Date().getFullYear()} TagAWallet</span>
                <Link href="/privacy" className="hover:underline">Privacy</Link>
                <Link href="/terms" className="hover:underline">Terms</Link>
              </p>
            </div>
          )}

          {/* In-page glance card — matches today's chip click */}
          {overlay?.kind === "card" && (
            <GlanceCard
              address={overlay.address}
              tag={tags[overlay.address]}
              appearance={appearance}
              onClose={() => setOverlay(null)}
              onTag={() => openPanel("tag", overlay.address)}
              onDetails={() => openPanel("page", overlay.address)}
            />
          )}

          {/* Floating panel — matches today's extension panel */}
          {overlay?.kind === "panel" && (
            <aside
              className="pop absolute bottom-3 right-3 z-40 flex max-h-[min(640px,calc(100%-1.5rem))] w-[min(384px,calc(100%-1.5rem))] flex-col overflow-hidden rounded-2xl text-[13px] shadow-[0_0_0_1px_rgba(26,26,24,.10),0_24px_64px_-16px_rgba(0,0,0,.45)]"
              style={{ background: theme.paper, color: theme.fg, colorScheme: appearance }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-label="TagAWallet"
            >
              <div className="flex items-center gap-2 border-b px-3 py-2.5" style={{ borderColor: theme.line }}>
                <BrandMark size={18} />
                <span className="font-semibold tracking-tight">TagAWallet</span>
                <span className="ml-auto text-[11px]" style={{ color: theme.muted }}>{current?.title ?? "Welcome"}</span>
                <button type="button" aria-label="Close" onClick={() => setOverlay(null)} className="grid size-7 place-items-center rounded-lg" style={{ color: theme.muted }}>
                  <Icon d={I.x} />
                </button>
              </div>

              {overlay.mode === "tag" && overlay.address
                ? (
                  <form id={formId} onSubmit={saveTag} className="min-h-0 flex-1 overflow-y-auto p-3.5">
                    <h2 className="text-[15px] font-semibold">Tag this wallet</h2>
                    <p className="mt-1 font-mono text-xs" style={{ color: theme.muted }} title={FULL[overlay.address as keyof typeof FULL] ?? overlay.address}>
                      {(FULL[overlay.address as keyof typeof FULL] ?? overlay.address).slice(0, 10)}…{(FULL[overlay.address as keyof typeof FULL] ?? overlay.address).slice(-6)} · Ethereum
                    </p>
                    <label className="mt-3 block text-xs font-medium">Who is this?
                      <input ref={nameRef} value={who} onChange={(e) => { setWho(e.target.value); if (!label || label === who) setLabel(e.target.value) }} maxLength={40} placeholder="Person or project" className="mt-1 w-full rounded-md border px-2.5 py-1.5 text-[13px] outline-none" style={{ borderColor: theme.line, background: theme.bg, color: theme.fg }} />
                    </label>
                    <label className="mt-3 block text-xs font-medium">Name for this address
                      <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={40} placeholder="Hot wallet, treasury…" className="mt-1 w-full rounded-md border px-2.5 py-1.5 text-[13px] outline-none" style={{ borderColor: theme.line, background: theme.bg, color: theme.fg }} />
                    </label>
                    <p className="mt-3 text-xs font-medium">Labels</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {([["mine", "Mine", theme.accent], ["trusted", "Trusted", theme.good], ["watchlist", "Watchlist", theme.warn]] as const).map(([v, l, tone]) => (
                        <button
                          key={v}
                          type="button"
                          aria-pressed={status === v}
                          onClick={() => setStatus(status === v ? "none" : v)}
                          className="inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium"
                          style={status === v
                            ? { color: tone, borderColor: tone, background: `color-mix(in srgb, ${tone} 14%, transparent)` }
                            : { borderColor: theme.line, color: theme.muted }}
                        >
                          <span aria-hidden className="size-1.5 rounded-full" style={{ background: tone }} />
                          {l}
                        </button>
                      ))}
                    </div>
                    <p className="mt-3 rounded-lg px-2.5 py-2 text-xs" style={{ background: theme.wash, color: theme.muted }}>Private to you</p>
                    <div className="mt-3 flex gap-1.5">
                      <button type="submit" className="flex-1 rounded-lg py-2 font-medium" style={{ background: theme.accent, color: theme.accentInk }}>Save</button>
                      <button type="button" onClick={() => setOverlay({ kind: "panel", mode: "page" })} className="flex-1 rounded-lg border py-2 font-medium" style={{ borderColor: theme.line, background: theme.bg, color: theme.fg }}>Cancel</button>
                    </div>
                  </form>
                  )
                : (
                  <div className="min-h-0 flex-1 overflow-y-auto p-3">
                    <div className="flex items-center gap-3 rounded-xl border px-3 py-2.5" style={{ borderColor: theme.line, background: theme.bg }}>
                      <span className="min-w-0 flex-1">
                        <strong className="block truncate text-[13px]">{current?.url.split("/")[0] ?? "tagawallet.com"}</strong>
                        <span className="text-[11px]" style={{ color: theme.muted }}>{enabled ? `${pageAddresses.length} addresses on this page` : "Off on this site"}</span>
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={enabled}
                        aria-label={`TagAWallet on ${current?.title ?? "this site"}`}
                        onClick={() => setEnabled((v) => !v)}
                        className="relative h-5 w-9 rounded-full transition-colors"
                        style={{ background: enabled ? theme.accent : theme.line }}
                      >
                        <span className={`absolute left-0.5 top-0.5 size-4 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-4" : ""}`} />
                      </button>
                    </div>

                    {!enabled && (
                      <p className="mt-3 rounded-lg border px-3 py-2 text-xs" style={{ borderColor: theme.line, background: theme.wash, color: theme.muted }}>
                        Turn it on to see names next to addresses here. Only addresses are looked up, never the page.
                      </p>
                    )}

                    {enabled && (
                      <>
                        <div className="mt-3 grid grid-cols-3 gap-1.5">
                          {[
                            { n: 0, l: "Flagged", c: theme.bad },
                            { n: pageAddresses.filter((a) => tags[a]).length, l: "Tagged", c: theme.good },
                            { n: pageAddresses.filter((a) => !tags[a]).length, l: "Not tagged", c: theme.fg },
                          ].map((s) => (
                            <div key={s.l} className="rounded-xl border px-2 py-2 text-center" style={{ borderColor: theme.line, background: theme.bg }}>
                              <b className="block text-base" style={{ color: s.c }}>{s.n}</b>
                              <span className="text-[11px]" style={{ color: theme.muted }}>{s.l}</span>
                            </div>
                          ))}
                        </div>

                        {(["Tagged", "Not tagged"] as const).map((group) => {
                          const rows = pageAddresses.filter((a) => (group === "Tagged" ? !!tags[a] : !tags[a]))
                          if (!rows.length) return null
                          return (
                            <section key={group} className="mt-3">
                              <h2 className="mb-1 text-xs font-semibold" style={{ color: theme.muted }}>{group} · {rows.length}</h2>
                              <ul className="overflow-hidden rounded-xl border" style={{ borderColor: theme.line, background: theme.bg }}>
                                {rows.map((a) => {
                                  const t = tags[a]
                                  return (
                                    <li key={a} className="flex items-center gap-2 border-t px-2.5 py-2 first:border-0" style={{ borderColor: theme.line }}>
                                      <span className="grid size-8 shrink-0 place-items-center rounded-full text-[11px] font-semibold" style={{ background: theme.wash, color: theme.muted }}>
                                        {t ? initials(t.who || t.name) : "?"}
                                      </span>
                                      <span className="min-w-0 flex-1">
                                        <span className="block truncate font-medium">{t?.name ?? a}</span>
                                        <span className="block truncate font-mono text-[11px]" style={{ color: theme.muted }}>{t ? a : "Ethereum"}</span>
                                      </span>
                                      {!t && (
                                        <button type="button" onClick={() => openPanel("tag", a)} className="rounded-md px-2.5 py-1 text-xs font-medium" style={{ background: theme.accent, color: theme.accentInk }}>
                                          Tag
                                        </button>
                                      )}
                                      {t?.tone === "verified" && <span className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: `color-mix(in srgb, ${theme.good} 15%, transparent)`, color: theme.good }}>✓ Verified</span>}
                                      {t?.tone === "shared" && <span className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: `color-mix(in srgb, ${theme.warn} 15%, transparent)`, color: theme.warn }}>Shared</span>}
                                    </li>
                                  )
                                })}
                              </ul>
                            </section>
                          )
                        })}
                      </>
                    )}
                    <p className="mt-3 px-1 text-[11px]" style={{ color: theme.muted }}>Not a wallet. It holds no funds and never asks for a seed phrase.</p>
                  </div>
                  )}
            </aside>
          )}
        </div>

        {/* Guided quest */}
        <div aria-live="polite" className="flex shrink-0 flex-col gap-1.5 border-t px-3 py-2.5 text-xs md:flex-row md:items-center md:gap-4 md:px-4" style={{ borderColor: LIGHT.line, background: LIGHT.wash, color: LIGHT.fg }}>
          <p className="font-medium md:max-w-sm">{hint}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 md:ml-auto">
            {QUEST.map((q, i) => (
              <span key={q} style={{ color: done[i] ? LIGHT.good : i === done.findIndex((d) => !d) ? LIGHT.fg : LIGHT.muted }} className={done[i] ? "line-through" : i === done.findIndex((d) => !d) ? "font-semibold" : ""}>
                <span aria-hidden>{done[i] ? "✓" : `${i + 1}.`}</span> {q.replace(/ on Etherscan| on X| on Uniswap| in DeBank/, "")}
              </span>
            ))}
          </div>
        </div>
    </div>
  )
}

export function SurfLanding ({ signedIn }: { signedIn: boolean }) {
  return (
    <div className="flex h-dvh flex-col overflow-hidden" style={SHELL}>
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 md:px-5">
        <div className="min-w-0">
          <Logo className="hidden sm:inline-flex" />
          <h1 className="mt-1 text-lg font-semibold leading-tight tracking-tight md:mt-2 md:text-3xl">
            Tag once. Browse everywhere.
            <span className="font-normal text-muted"> The extension follows you.</span>
          </h1>
        </div>
        <nav className="flex items-center gap-3 text-sm">
          <Link href="/login" className="hover:underline">Sign in</Link>
          <Link href={signedIn ? "/dashboard" : "/signup"} className="rounded-md bg-accent px-3 py-1.5 font-medium text-accent-ink">
            {signedIn ? "Dashboard" : "Get started"}
          </Link>
        </nav>
      </header>
      <SurfBrowser signedIn={signedIn} className="mx-2 mb-2 md:mx-4 md:mb-14" />
    </div>
  )
}

function GlanceCard ({ address, tag, appearance, onClose, onTag, onDetails }: {
  address: string
  tag?: Tag
  appearance: Appearance
  onClose: () => void
  onTag: () => void
  onDetails: () => void
}) {
  const c = PALETTE[appearance]
  const full = FULL[address as keyof typeof FULL] ?? address
  const pill = (tone: string, label: string) => (
    <span className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: `color-mix(in srgb, ${tone} 14%, transparent)`, color: tone }}>{label}</span>
  )
  return (
    <div
      role="dialog"
      aria-label={tag ? tag.name : "Not tagged yet"}
      className="pop absolute left-1/2 top-24 z-30 w-[min(320px,calc(100%-2rem))] -translate-x-1/2 rounded-2xl p-3.5 text-[13px] shadow-[0_0_0_1px_rgba(26,26,24,.10),0_24px_64px_-16px_rgba(0,0,0,.4)] md:left-auto md:right-8 md:translate-x-0"
      style={{ background: c.raised, color: c.fg, colorScheme: appearance }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: c.muted }}>
        <BrandMark size={16} />
        <span className="flex-1">TagAWallet</span>
        <button type="button" aria-label="Close" onClick={onClose} className="grid size-7 place-items-center rounded-lg" style={{ color: c.muted }}>
          <Icon d={I.x} />
        </button>
      </div>
      {tag
        ? (
          <>
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden
                className="grid size-9 place-items-center rounded-full text-xs font-semibold"
                style={{
                  background: c.wash,
                  color: c.muted,
                  boxShadow: tag.tone === "verified" ? `0 0 0 2px ${c.raised}, 0 0 0 3.5px ${c.good}` : undefined,
                }}
              >
                {initials(tag.who || tag.name)}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-base font-semibold tracking-tight">{tag.who || tag.name}</h2>
                <p className="truncate text-xs" style={{ color: c.muted }}>{tag.who && tag.who !== tag.name ? tag.name : tag.source}</p>
              </div>
              {tag.tone === "verified" && pill(c.good, "✓ Verified")}
              {tag.tone === "shared" && pill(c.warn, "Shared")}
              {tag.tone === "yours" && pill(c.accent, "Your tag")}
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-[10px] py-1 pl-2.5 pr-1" style={{ background: c.wash }}>
              <span className="min-w-0 flex-1 truncate font-mono text-xs">{full.slice(0, 10)}…{full.slice(-8)} <span style={{ color: c.muted }}>· Eth</span></span>
            </div>
            <div className="mt-3.5 flex gap-1.5">
              <button type="button" onClick={onDetails} className="flex-1 rounded-[9px] border py-2 font-medium" style={{ borderColor: c.line, background: c.bg, color: c.fg }}>Details</button>
              <button type="button" onClick={onTag} className="flex flex-1 items-center justify-center gap-1.5 rounded-[9px] py-2 font-medium" style={{ background: c.accent, color: c.accentInk }}>
                <Icon d={I.tag} /> Edit
              </button>
            </div>
          </>
          )
        : (
          <>
            <h2 className="text-base font-semibold tracking-tight">Not tagged yet</h2>
            <div className="mt-3 flex items-center gap-2 rounded-[10px] py-1 pl-2.5 pr-1" style={{ background: c.wash }}>
              <span className="min-w-0 flex-1 truncate font-mono text-xs">{full.slice(0, 10)}…{full.slice(-8)} <span style={{ color: c.muted }}>· Eth</span></span>
            </div>
            <div className="mt-3.5">
              <button type="button" onClick={onTag} className="flex w-full items-center justify-center gap-1.5 rounded-[9px] py-2 font-medium" style={{ background: c.accent, color: c.accentInk }}>
                <Icon d={I.tag} /> Tag this wallet
              </button>
            </div>
          </>
          )}
    </div>
  )
}

type SiteProps = { chip: (address: string) => ReactNode }

function ScanSite ({ chip }: SiteProps) {
  const rows = [
    ["0xb71a…40ce", MYSTERY, "1,204.50 ETH", "2 mins ago"],
    [MYSTERY, "0x72ca…1e06", "88.00 ETH", "9 mins ago"],
    ["0x9e0b…77d1", MYSTERY, "310.20 ETH", "14 mins ago"],
    ["0x03fd…a98b", "0xb71a…40ce", "12.00 ETH", "21 mins ago"],
    ["0x72ca…1e06", "0x9e0b…77d1", "41.25 ETH", "33 mins ago"],
    ["0xb71a…40ce", "0x03fd…a98b", "540.00 ETH", "48 mins ago"],
  ] as const

  return (
    <div className="min-h-full bg-[#f8f9fa] text-[13px] text-[#212529]">
      <div className="border-b border-[#e9ecef] bg-[#21325b] text-white">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3 md:px-6">
          <span className="text-lg font-semibold tracking-tight">etherscan</span>
          <span className="hidden rounded bg-white/10 px-2 py-0.5 text-[11px] text-white/80 sm:inline">ETH Price: $3,412.08</span>
          <div className="ml-auto flex max-w-xs flex-1 items-center gap-2 rounded-md bg-white/10 px-2.5 py-1.5 text-xs text-white/70">
            <Icon d={I.search} size={12} /> Search by Address / Txn Hash
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-5xl px-4 py-4 md:px-6">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">Transactions</h2>
            <p className="text-xs text-[#6c757d]">More than 2,847,102,441 transactions found</p>
          </div>
          <span className="rounded border border-[#dbe2ea] bg-white px-2 py-1 text-[11px] text-[#6c757d]">Ethereum Mainnet</span>
        </div>
        <div className="overflow-hidden rounded-lg border border-[#e9ecef] bg-white shadow-sm">
          <div className="hidden grid-cols-[1.1fr_1.1fr_.7fr_.7fr] gap-3 border-b border-[#e9ecef] bg-[#f8f9fa] px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-[#6c757d] md:grid">
            <span>From</span><span>To</span><span>Value</span><span className="text-right">Age</span>
          </div>
          {rows.map(([from, to, value, age]) => (
            <div key={from + to + age} className="grid gap-2 border-b border-[#e9ecef] px-4 py-3 last:border-0 md:grid-cols-[1.1fr_1.1fr_.7fr_.7fr] md:items-center md:gap-3">
              <div className="min-w-0"><span className="mr-1 text-[11px] text-[#6c757d] md:hidden">From</span>{chip(from)}</div>
              <div className="min-w-0"><span className="mr-1 text-[11px] text-[#6c757d] md:hidden">To</span>{chip(to)}</div>
              <span className="font-mono text-xs">{value}</span>
              <span className="text-xs text-[#6c757d] md:text-right">{age}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function XSite ({ chip }: SiteProps) {
  const posts = [
    { h: "onchain_notes", n: "Onchain Notes", t: "4m", body: <>Big move this morning — funds went straight to {chip(MYSTERY)}. Anyone know who that is?</> },
    { h: "ledger_lore", n: "Ledger Lore", t: "11m", body: <>Same counterparty as last week. Came out of {chip("0xb71a…40ce")}.</> },
    { h: "dao_watcher", n: "DAO Watcher", t: "1h", body: <>{chip("0x9e0b…77d1")} just moved 310 ETH. Quiet week until now.</> },
  ]

  return (
    <div className="min-h-full bg-black text-[15px] text-[#e7e9ea]">
      <div className="mx-auto flex max-w-2xl">
        <aside className="hidden w-16 shrink-0 flex-col items-center gap-5 py-3 sm:flex md:w-48 md:items-stretch md:px-3">
          <span className="px-2 text-2xl font-bold">𝕏</span>
          {["Home", "Explore", "Notifications", "Messages"].map((l) => (
            <span key={l} className="rounded-full px-3 py-2 text-[15px] font-medium text-[#e7e9ea]/80">{l}</span>
          ))}
        </aside>
        <div className="min-w-0 flex-1 border-x border-[#2f3336]">
          <div className="sticky top-0 z-10 border-b border-[#2f3336] bg-black/80 px-4 py-3 font-bold backdrop-blur">Home</div>
          {posts.map((p) => (
            <article key={p.h} className="flex gap-3 border-b border-[#2f3336] px-4 py-3">
              <span aria-hidden className="size-10 shrink-0 rounded-full bg-[#1d9bf0]/25" />
              <div className="min-w-0 leading-snug">
                <p><span className="font-bold">{p.n}</span> <span className="text-[#71767b]">@{p.h} · {p.t}</span></p>
                <p className="mt-1 text-[15px] leading-relaxed">{p.body}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  )
}

function SwapSite ({ chip }: SiteProps) {
  const rows = [
    [MYSTERY, "Buy ETH", "+88.0", "$300,416"],
    ["0x72ca…1e06", "Sell ETH", "-41.2", "$140,574"],
    ["0xb71a…40ce", "Buy ETH", "+540.0", "$1.84M"],
    ["0x03fd…a98b", "Sell ETH", "-12.0", "$40,944"],
  ] as const

  return (
    <div className="min-h-full bg-[#131313] text-[13px] text-white">
      <header className="flex items-center gap-4 border-b border-white/10 px-4 py-3 md:px-6">
        <span className="flex items-center gap-2 font-semibold tracking-tight">
          <span aria-hidden className="grid size-7 place-items-center rounded-full bg-[#fc72ff] text-[11px] font-bold text-black">U</span>
          Uniswap
        </span>
        <nav className="hidden gap-1 text-sm text-white/60 sm:flex">
          {["Swap", "Explore", "Pool", "Top traders"].map((l, i) => (
            <span key={l} className={`rounded-full px-3 py-1.5 ${i === 3 ? "bg-white/10 text-white" : ""}`}>{l}</span>
          ))}
        </nav>
        <span className="ml-auto rounded-full bg-[#fc72ff] px-3 py-1.5 text-xs font-semibold text-black">Connect</span>
      </header>
      <div className="mx-auto max-w-3xl px-4 py-6 md:px-6">
        <div className="mb-4">
          <h2 className="text-xl font-semibold tracking-tight">Top traders</h2>
          <p className="text-sm text-white/50">Last 24 hours · Ethereum</p>
        </div>
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#1b1b1b]">
          <div className="grid grid-cols-[1.4fr_.7fr_.6fr] gap-2 border-b border-white/10 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-white/40 md:grid-cols-[1.6fr_.7fr_.6fr_.7fr]">
            <span>Account</span><span>Side</span><span className="text-right">Size</span><span className="hidden text-right md:block">Notional</span>
          </div>
          {rows.map(([a, side, size, notional]) => (
            <div key={a + side} className="grid grid-cols-[1.4fr_.7fr_.6fr] items-center gap-2 border-b border-white/5 px-4 py-3.5 last:border-0 md:grid-cols-[1.6fr_.7fr_.6fr_.7fr]">
              {chip(a)}
              <span className={`text-xs font-medium ${side.startsWith("Buy") ? "text-[#40b66b]" : "text-[#ff5f52]"}`}>{side}</span>
              <span className="text-right font-mono text-xs">{size}</span>
              <span className="hidden text-right font-mono text-xs text-white/50 md:block">{notional}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function VaultSite ({ chip }: SiteProps) {
  return (
    <div className="min-h-full bg-[#f5f6f7] text-[13px] text-[#222]">
      <header className="border-b border-[#e6e8eb] bg-white">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3 md:px-6">
          <span className="flex items-center gap-2 font-semibold"><span aria-hidden className="size-6 rounded bg-[#ff6933]" />DeBank</span>
          <span className="ml-auto rounded-full border border-[#e6e8eb] px-3 py-1 text-xs text-[#666]">Portfolio</span>
        </div>
      </header>
      <div className="mx-auto max-w-4xl px-4 py-5 md:px-6">
        <div className="rounded-2xl border border-[#e6e8eb] bg-white p-4 md:p-5">
          <div className="flex flex-wrap items-center gap-3">
            <span aria-hidden className="grid size-12 place-items-center rounded-full bg-[#ff6933]/15 text-sm font-bold text-[#ff6933]">0x</span>
            <div className="min-w-0">
              <p className="text-xs text-[#888]">Profile</p>
              <div className="mt-0.5">{chip(MYSTERY)}</div>
            </div>
            <div className="ml-auto text-right">
              <p className="text-xs text-[#888]">Net worth</p>
              <p className="text-xl font-semibold tracking-tight">$1,284,920</p>
            </div>
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            {[["ETH", "412.8", "$1,409,280"], ["USDC", "82,400", "$82,400"], ["WBTC", "1.24", "$84,320"]].map(([t, amt, usd]) => (
              <div key={t} className="rounded-xl border border-[#eef0f2] bg-[#fafbfc] px-3 py-3">
                <p className="text-xs text-[#888]">{t}</p>
                <p className="mt-1 font-semibold">{amt}</p>
                <p className="text-xs text-[#888]">{usd}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-4 overflow-hidden rounded-2xl border border-[#e6e8eb] bg-white">
          <div className="border-b border-[#eef0f2] px-4 py-3 font-semibold">Recent counterparties</div>
          {([["0xb71a…40ce", "Received", "+1,204.5 ETH"], [MYSTERY, "Sent", "-88.0 ETH"], ["0x9e0b…77d1", "Received", "+310.2 ETH"]] as const).map(([a, side, amt]) => (
            <div key={a + side} className="flex flex-wrap items-center gap-3 border-b border-[#eef0f2] px-4 py-3 last:border-0">
              {chip(a)}
              <span className="text-xs text-[#888]">{side}</span>
              <span className="ml-auto font-mono text-xs">{amt}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
