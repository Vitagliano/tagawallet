/** Where the "Add to Chrome" buttons go. Until the store listing is live, /extension explains what's coming. */
export const EXTENSION_STORE_URL = process.env.NEXT_PUBLIC_EXTENSION_STORE_URL || "";
export const EXTENSION_HREF = EXTENSION_STORE_URL || "/extension";

/** Chromium browsers the extension runs in. The install button names the visitor's own. */
export const BROWSERS = { chrome: "Chrome", brave: "Brave", edge: "Edge" } as const;
export type Browser = keyof typeof BROWSERS;
