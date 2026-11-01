export const LINK_TYPES = ["x", "website", "ens", "telegram", "discord", "github", "linkedin", "youtube", "custom"] as const;
export type LinkType = (typeof LINK_TYPES)[number];

export const LINK_TYPE_LABELS: Record<LinkType, string> = {
  x: "X", website: "Website", ens: "ENS", telegram: "Telegram", discord: "Discord",
  github: "GitHub", linkedin: "LinkedIn", youtube: "YouTube", custom: "Link",
};

const ALLOWED_HOSTS: Partial<Record<LinkType, RegExp>> = {
  x: /^(www\.)?(x|twitter)\.com$/,
  telegram: /^(www\.)?(t\.me|telegram\.me)$/,
  discord: /^(www\.)?(discord\.gg|discord\.com)$/,
  github: /^(www\.)?github\.com$/,
  linkedin: /^([a-z]+\.)?linkedin\.com$/,
  youtube: /^(www\.|m\.)?(youtube\.com|youtu\.be)$/,
};

/** Returns a safe absolute http(s) URL, or null. This is the only gate for stored links. */
export function sanitizeUrl(input: string): string | null {
  const value = input.trim();
  // eslint-disable-next-line no-control-regex
  if (!value || value.length > 2048 || /[\u0000-\u001f\\]/.test(value)) return null;
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(value) && !/^[^/:]+:\d+(\/|$)/.test(value);
  let url: URL;
  try {
    url = new URL(hasScheme ? value : `https://${value}`);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password || !url.hostname.includes(".")) return null;
  return url.toString();
}

/** Accepts handles as well as URLs for the link types that have them. */
export function normalizeLink(type: LinkType, input: string): string | null {
  const value = input.trim();
  if (type === "ens") {
    const name = value.replace(/^https?:\/\/(app\.)?ens\.domains\/(name\/)?/i, "").replace(/\/$/, "").toLowerCase();
    return /^([a-z0-9-]+\.)+eth$/.test(name) ? name : null;
  }
  let candidate = value;
  const handle = value.replace(/^@/, "");
  if (/^[A-Za-z0-9_.-]+$/.test(handle) && !handle.includes(".")) {
    if (type === "x") candidate = `https://x.com/${handle}`;
    if (type === "telegram") candidate = `https://t.me/${handle}`;
    if (type === "github") candidate = `https://github.com/${handle}`;
  }
  const url = sanitizeUrl(candidate);
  if (!url) return null;
  const rule = ALLOWED_HOSTS[type];
  return rule && !rule.test(new URL(url).hostname) ? null : url;
}

export function linkHref(type: LinkType, value: string): string {
  return type === "ens" ? `https://app.ens.domains/${value}` : value;
}

// First path segments on X that are app pages, not accounts.
const X_RESERVED = new Set(["home", "explore", "notifications", "messages", "i", "settings", "search", "compose", "login", "logout", "signup", "tos", "privacy", "about", "jobs", "hashtag", "intent", "share", "bookmarks", "lists", "communities", "premium"]);

/** The lowercase handle a path like /Uniswap or /Uniswap/media belongs to, or null for app pages. */
export function xHandleFromPath(pathname: string): string | null {
  const first = pathname.split("/")[1] ?? "";
  if (!/^[A-Za-z0-9_]{1,15}$/.test(first)) return null;
  const handle = first.toLowerCase();
  return X_RESERVED.has(handle) ? null : handle;
}

export function xHandleFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    return /^(www\.|mobile\.)?(x|twitter)\.com$/.test(u.hostname) ? xHandleFromPath(u.pathname) : null;
  } catch {
    return null;
  }
}
