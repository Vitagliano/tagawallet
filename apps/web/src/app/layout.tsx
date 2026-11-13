import type { Metadata } from "next";
import { Instrument_Sans, JetBrains_Mono } from "next/font/google";
import { headers } from "next/headers";
import { ThemeFavicon } from "@/components/theme-favicon";
import { currentUser } from "@/lib/session";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE } from "@/lib/site";
import "./globals.css";

const sans = Instrument_Sans({ subsets: ["latin"], variable: "--font-instrument" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

const baseMetadata = {
  title: { default: SITE_TITLE, template: `%s · ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
} satisfies Metadata;

/** Forced light/dark get a fixed favicon; "system" keeps the adaptive app/icon.svg. */
export async function generateMetadata(): Promise<Metadata> {
  const user = await currentUser().catch(() => null);
  const theme = user && user.themeScope !== "extension" && user.theme !== "system" ? user.theme : undefined;
  if (theme === "dark") return { ...baseMetadata, icons: { icon: [{ url: "/icon-dark.svg", type: "image/svg+xml" }] } };
  if (theme === "light") return { ...baseMetadata, icons: { icon: [{ url: "/icon-light.svg", type: "image/svg+xml" }] } };
  return baseMetadata;
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Reading headers renders per request, which is what lets Next apply the CSP nonce to its scripts.
  await headers();
  // A theme picked in Settings → Display applies to the website unless it's "extension only". Set here, so there's no flash.
  const user = await currentUser().catch(() => null);
  const theme = user && user.themeScope !== "extension" && user.theme !== "system" ? user.theme : undefined;
  return (
    <html lang="en" data-theme={theme} className={`${sans.variable} ${mono.variable}`}>
      <body className="min-h-dvh antialiased">
        <ThemeFavicon />
        {children}
      </body>
    </html>
  );
}
