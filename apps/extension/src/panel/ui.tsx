import { useEffect, useRef, useState, type ReactNode } from "react";
import { CHAINS, truncateAddress } from "@tagawallet/shared/lite";
import { MARK_PARTS } from "../lib/brand-mark-paths";

/** Small pieces mirroring the dashboard's v3.2 kit: 1.5px outline icons, press feedback, quiet icon buttons. */

const PATHS = {
  search: <><circle cx="7" cy="7" r="4.25" /><path d="m10.25 10.25 3 3" /></>,
  chevronLeft: <path d="M9.5 4.5 6 8l3.5 3.5" />,
  chevronRight: <path d="M6.5 4.5 10 8l-3.5 3.5" />,
  x: <path d="m4.5 4.5 7 7m0-7-7 7" />,
  copy: <><rect x="5.5" y="5.5" width="7" height="7" rx="1.5" /><path d="M10.5 5.5v-1A1.5 1.5 0 0 0 9 3H4.5A1.5 1.5 0 0 0 3 4.5V9a1.5 1.5 0 0 0 1.5 1.5h1" /></>,
  check: <path d="m3.5 8.5 3 3 6-7" />,
  external: <path d="M6.5 3.5h-2a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1v-2M9 3.5h3.5V7M12.5 3.5 7.5 8.5" />,
  plus: <path d="M8 3.5v9M3.5 8h9" />,
  sidebar: <><rect x="2.5" y="3" width="11" height="10" rx="1.5" /><path d="M10 3v10" /></>,
  float: <><rect x="2.5" y="3" width="11" height="10" rx="1.5" /><rect x="7.5" y="7.5" width="4.5" height="3.5" rx=".75" /></>,
  settings: <><path d="M6.9 1.75h2.2l.35 1.55 1.15.48 1.35-.85 1.55 1.55-.85 1.35.48 1.15 1.55.35v2.2l-1.55.35-.48 1.15.85 1.35-1.55 1.55-1.35-.85-1.15.48-.35 1.55H6.9l-.35-1.55-1.15-.48-1.35.85-1.55-1.55.85-1.35-.48-1.15-1.55-.35V6.9l1.55-.35.48-1.15-.85-1.35 1.55-1.55 1.35.85 1.15-.48Z" /><circle cx="8" cy="8" r="2" /></>,
  chevronDown: <path d="M4.5 6.5 8 10l3.5-3.5" />,
  target: <><circle cx="8" cy="8" r="4.5" /><circle cx="8" cy="8" r="1.25" /><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2" /></>,
  tag: <><path d="M2.75 3.5a.75.75 0 0 1 .75-.75h4.1l5.65 5.65a.75.75 0 0 1 0 1.06l-3.6 3.6a.75.75 0 0 1-1.06 0L2.94 7.41a.75.75 0 0 1-.19-.5Z" /><circle cx="5.5" cy="5.5" r=".9" /></>,
  page: <><rect x="3" y="2.5" width="10" height="11" rx="1.5" /><path d="M5.5 6h5M5.5 8.5h5M5.5 11h3" /></>,
  library: <><path d="M3 3.5h3v9H3zM7 3.5h3v9H7z" /><path d="m11 4 2.5-.6 1.6 8.8-2.5.6z" /></>,
} as const;
export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}>
      {PATHS[name]}
    </svg>
  );
}

export function IconButton({ icon, label, onClick, disabled }: { icon: IconName; label: string; onClick: () => void; disabled?: boolean }) {
  return <button type="button" className="icon-btn press" aria-label={label} title={label} disabled={disabled} onClick={onClick}><Icon name={icon} /></button>;
}

const FILL = { brand: "#EE6A42", white: "#fff", ink: "currentColor" };
export function Logo() {
  return (
    <span className="logo">
      <svg viewBox="0 0 515 415" width={24} height={(24 * 415) / 515} fill="none" aria-hidden>
        {MARK_PARTS.map((p) => <path key={p.id} d={p.d} fill={FILL[p.tone]} fillRule={p.evenodd ? "evenodd" : undefined} clipRule={p.evenodd ? "evenodd" : undefined} />)}
      </svg>
      TagAWallet
    </span>
  );
}

export const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");

export type Kind = "list" | "person" | "project";
export const kindOf = (type?: string): Kind => (type === "individual" ? "person" : "project");
export const KIND_LABEL: Record<Kind, string> = { list: "List", person: "Person", project: "Project" };

export function KindIcon({ kind }: { kind: Kind }) {
  const paths: Record<Kind, ReactNode> = {
    list: <path d="M4 6h16M4 12h16M4 18h10" />,
    person: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20c1.2-3.6 4-5.5 7-5.5s5.8 1.9 7 5.5" /></>,
    project: <><rect x="4" y="7" width="16" height="13" rx="2" /><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></>,
  };
  return <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="kind">{paths[kind]}</svg>;
}

export function Avatar({ name, kind, url }: { name: string; kind: Kind; url?: string }) {
  if (kind === "list") return <KindIcon kind="list" />;
  return <span aria-hidden className="avatar">{url ? <img src={url} alt="" referrerPolicy="no-referrer" /> : initials(name)}</span>;
}

/** The dashboard's built-in labels, with the same tones. */
const STATUS: Record<string, { label: string; tone: string }> = {
  mine: { label: "Mine", tone: "var(--accent)" }, trusted: { label: "Trusted", tone: "var(--good)" },
  watchlist: { label: "Watchlist", tone: "var(--warn)" }, scam: { label: "Scam", tone: "var(--bad)" },
};
export function StatusPill({ status }: { status?: string }) {
  if (!status || status === "none") return null;
  const s = STATUS[status];
  return <span className="pill"><span className="tone" style={{ ["--tone" as string]: s?.tone ?? "var(--muted)" }} />{s?.label ?? status}</span>;
}
export function Labels({ status, tags = [], max = 4 }: { status?: string; tags?: string[]; max?: number }) {
  const shown = tags.slice(0, Math.max(0, max - (status && status !== "none" ? 1 : 0)));
  if (!shown.length && (!status || status === "none")) return null;
  return (
    <span className="labels">
      <StatusPill status={status} />
      {shown.map((t) => <span key={t} className="pill">{t}</span>)}
      {tags.length > shown.length && <span className="muted">+{tags.length - shown.length}</span>}
    </span>
  );
}

export const chainName = (chain: string) => CHAINS[chain as keyof typeof CHAINS]?.name ?? chain;
export function Address({ value, chain }: { value: string; chain?: string }) {
  return <span className="addr" title={value}>{truncateAddress(value)}{chain ? ` · ${chainName(chain)}` : ""}</span>;
}

export function Bone({ w, h = 12 }: { w: number | string; h?: number }) {
  return <span aria-hidden className="bone" style={{ width: w, height: h }} />;
}

export function Skeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading" style={{ display: "grid", gap: 14, padding: "16px 10px" }}>
      {Array.from({ length: rows }, (_, i) => (
        <span key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Bone w={22} h={22} /><Bone w={`${50 + ((i * 17) % 35)}%`} />
        </span>
      ))}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="empty"><p className="title">{title}</p>{children && <div className="sub">{children}</div>}</div>;
}

/** Copy that swaps to a check, like the dashboard's. Only ever on an explicit click. */
export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className="btn sm ghost press" aria-label={`${label} ${truncateAddress(text)}`} onClick={async () => {
      await navigator.clipboard.writeText(text).catch(() => {});
      setDone(true);
      setTimeout(() => setDone(false), 1400);
    }}>
      <Icon name={done ? "check" : "copy"} size={14} />{done ? "Copied" : label}
    </button>
  );
}

/** One line that fades at the end only when it doesn't fit, as on the dashboard. Short names are left alone. */
export function FadeText({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [over, setOver] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setOver(el.scrollWidth > el.clientWidth + 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [children]);
  return <span ref={ref} data-overflow={over || undefined} title={over && typeof children === "string" ? children : undefined} className={`fade ${className}`}>{children}</span>;
}

/**
 * A wallet as one compact row, like the dashboard's table: the name, its address, and its label.
 * A click opens its details and actions underneath. `quick` is one action that stays on the row.
 */
export function WalletItem({ tone, title, sub, pill, quick, defaultOpen = false, children }: {
  tone: "flagged" | "tagged" | "unknown" | "none"; title: ReactNode; sub: ReactNode; pill?: ReactNode; quick?: ReactNode; defaultOpen?: boolean; children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`w${tone === "flagged" ? " flagged" : ""}${open ? " open" : ""}`}>
      <div className="w-row">
        <button type="button" className="w-main" aria-expanded={open} onClick={() => setOpen(!open)}>
          {tone !== "none" && <span className={`dot ${tone}`} aria-hidden />}
          <span className="w-text">
            <FadeText className="t">{title}</FadeText>
            <span className="s">{sub}</span>
          </span>
          {pill}
          <span className="chev" aria-hidden><Icon name="chevronDown" size={14} /></span>
        </button>
        {quick}
      </div>
      {open && <div className="w-detail">{children}</div>}
    </div>
  );
}

export function Switch({ on, label, onChange }: { on: boolean; label: string; onChange: () => void }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} className="switch" onClick={onChange}><span /></button>;
}
