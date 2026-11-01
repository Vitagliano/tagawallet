export function Logo() {
  return (
    <span className="logo">
      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden fill="none">
        <path d="M3 4.5A1.5 1.5 0 0 1 4.5 3h7.4c.4 0 .8.16 1.06.44l7.6 7.6a1.5 1.5 0 0 1 0 2.12l-7.4 7.4a1.5 1.5 0 0 1-2.12 0l-7.6-7.6A1.5 1.5 0 0 1 3 11.9V4.5Z" fill="var(--accent)" />
        <circle cx="8" cy="8" r="1.8" fill="var(--bg)" />
      </svg>
      TagAWallet
    </span>
  );
}

export const connectUrl = (base: string) => `${base}/extension/connect?ext=${chrome.runtime.id}`;

/** Requests one origin. Must be called directly from a click, or Chrome refuses. */
export function requestSite(host: string) {
  const scheme = host === "localhost" ? "http" : "https";
  return chrome.permissions.request({ origins: [`${scheme}://${host}/*`] });
}

export function requestSites(hosts: string[]) {
  return chrome.permissions.request({ origins: hosts.flatMap((h) => [`https://${h}/*`, `https://*.${h}/*`]) });
}
