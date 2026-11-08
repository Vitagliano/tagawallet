import { MARK_PARTS } from "./brand-mark-paths";

const FILL = { brand: "#EE6A42", white: "#fff", ink: "currentColor" };

export function BrandMark({ className = "", size }: { className?: string; size?: number }) {
  return (
    <svg viewBox="0 0 515 415" width={size} height={size ? (size * 415) / 515 : undefined} className={className} fill="none" aria-hidden>
      {MARK_PARTS.map((p) => (
        <path key={p.id} d={p.d} fill={FILL[p.tone]} fillRule={p.evenodd ? "evenodd" : undefined} clipRule={p.evenodd ? "evenodd" : undefined} />
      ))}
    </svg>
  );
}

export { FILL as MARK_FILL };
