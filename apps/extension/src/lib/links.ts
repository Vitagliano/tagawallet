import { LINK_TYPE_LABELS, type LinkType } from "@tagawallet/shared/lite";

/** An X or Farcaster link reads as the handle, which is what people recognize. Anything else, its label or kind. */
export function linkText(l: { type: string; label?: string }, url: string) {
  if (l.label) return l.label;
  if (l.type === "x" || l.type === "farcaster") {
    try {
      const handle = new URL(url).pathname.split("/").filter(Boolean)[0];
      if (handle && /^[\w.-]{1,40}$/.test(handle)) return `@${handle}`;
    } catch { /* not a URL */ }
  }
  return LINK_TYPE_LABELS[l.type as LinkType] || "Link";
}
