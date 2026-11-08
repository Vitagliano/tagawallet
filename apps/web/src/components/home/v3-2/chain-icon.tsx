import type { ChainId } from "@tagawallet/shared";

/**
 * Small, simplified chain marks in each chain's own colours, drawn inline so nothing loads from elsewhere.
 * They sit next to the chain name, never instead of it.
 */
const MARKS: Record<ChainId, { bg: string; mark: React.ReactNode }> = {
  ethereum: {
    bg: "#627EEA",
    mark: <><path d="M8 2.6 4.9 8.1 8 9.9l3.1-1.8z" fill="#fff" /><path d="M8 10.6 4.9 8.8 8 13.4l3.1-4.6z" fill="#fff" fillOpacity=".75" /></>,
  },
  base: {
    bg: "#0052FF",
    mark: <path d="M8 3.2a4.8 4.8 0 1 1-4.78 5.3h6.3V7.5h-6.3A4.8 4.8 0 0 1 8 3.2z" fill="#fff" />,
  },
  arbitrum: {
    bg: "#213147",
    mark: <><path d="m6.9 4 1.1-.6 1.1.6-2.9 7.9-1.3-.7z" fill="#9DCCED" /><path d="m9.1 4 2.9 7.2-1.3.7L8 5.3z" fill="#28A0F0" /></>,
  },
  optimism: {
    bg: "#FF0420",
    mark: <text x="8" y="10.4" textAnchor="middle" fontSize="6.4" fontWeight="800" fontFamily="system-ui, sans-serif" fill="#fff">OP</text>,
  },
  polygon: {
    bg: "#8247E5",
    mark: <path d="M10.3 6.3 9 5.6 7.7 6.3v1.5L6.4 8.6 5.1 7.8V6.3l1.3-.7 1 .6V5.3l-1-.6-2.2 1.3v2.6l2.2 1.3L8.6 8.6V7.1l1.3-.7 1.3.7v1.5l-1.3.8-1-.6v.9l1 .6 2.2-1.3V6z" fill="#fff" />,
  },
  bsc: {
    bg: "#F3BA2F",
    mark: <path d="m8 3.6 1.4 1.4L8 6.4 6.6 5zM5 6.6 6.4 8 5 9.4 3.6 8zm6 0L12.4 8 11 9.4 9.6 8zM8 9.6l1.4 1.4L8 12.4 6.6 11zM8 6.9 9.1 8 8 9.1 6.9 8z" fill="#fff" />,
  },
  solana: {
    bg: "#0B0B12",
    mark: <><defs><linearGradient id="sol-g" x1="4" y1="12" x2="12" y2="4" gradientUnits="userSpaceOnUse"><stop stopColor="#9945FF" /><stop offset="1" stopColor="#14F195" /></linearGradient></defs>
      <path d="M5.3 10.2h6.2l-.8.9H4.5zM5.3 4.9h6.2l-.8.9H4.5zM4.5 7.5h6.2l.8.9H5.3z" fill="url(#sol-g)" /></>,
  },
  bitcoin: {
    bg: "#F7931A",
    mark: <text x="8.2" y="11.1" textAnchor="middle" fontSize="8.6" fontWeight="700" fontFamily="system-ui, sans-serif" fill="#fff" transform="rotate(12 8 8)">₿</text>,
  },
};

export function ChainIcon({ chain, className = "size-4" }: { chain: string; className?: string }) {
  const m = MARKS[chain as ChainId];
  if (!m) return <span aria-hidden className={`inline-block shrink-0 rounded-full bg-wash ${className}`} />;
  return (
    <svg aria-hidden viewBox="0 0 16 16" className={`shrink-0 ${className}`}>
      <circle cx="8" cy="8" r="8" fill={m.bg} />
      {m.mark}
    </svg>
  );
}
