/** Shared copy for HTML metadata and social cards. */
export const SITE_NAME = "TagAWallet";
export const SITE_TITLE = "TagAWallet: know who's behind every wallet";
export const SITE_DESCRIPTION =
  "Privately tag addresses, link socials, group related wallets, and recognize identities wherever you research and trade.";
export const SITE_TAGLINE = "Know who's behind every wallet.";

/** Open Graph + Twitter fields that mirror a page's title and description. */
export function socialMetadata (title: string, description: string) {
  return {
    openGraph: { title, description, siteName: SITE_NAME, type: "website" as const },
    twitter: { card: "summary_large_image" as const, title, description },
  };
}
