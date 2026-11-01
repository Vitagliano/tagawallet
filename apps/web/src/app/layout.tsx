import type { Metadata } from "next";
import { Instrument_Sans, JetBrains_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const sans = Instrument_Sans({ subsets: ["latin"], variable: "--font-instrument" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

export const metadata: Metadata = {
  title: { default: "TagAWallet: know who's behind every wallet", template: "%s · TagAWallet" },
  description: "Privately tag addresses, link socials, group related wallets, and recognize identities wherever you research and trade.",
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Reading headers renders per request, which is what lets Next apply the CSP nonce to its scripts.
  await headers();
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
