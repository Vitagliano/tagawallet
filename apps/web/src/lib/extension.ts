/** Live Chrome Web Store listing. Override with NEXT_PUBLIC_EXTENSION_STORE_URL if needed. */
export const EXTENSION_STORE_URL =
  process.env.NEXT_PUBLIC_EXTENSION_STORE_URL ||
  "https://chromewebstore.google.com/detail/tagawallet/dhjaifahojagcbfnammhpcfpijiiffhc";

/** Where the "Add to Chrome" buttons go. Falls back to /extension only if the store URL is cleared. */
export const EXTENSION_HREF = EXTENSION_STORE_URL || "/extension";

/** Chromium browsers the extension runs in. The install button names the visitor's own. */
export const BROWSERS = { chrome: "Chrome", brave: "Brave", edge: "Edge" } as const;
export type Browser = keyof typeof BROWSERS;
