import Link from "next/link";
import { Logo } from "@/components/ui";

export const metadata = { title: "Privacy" };

export default function Privacy() {
  return (
    <main className="mx-auto w-full max-w-2xl space-y-4 px-4 py-8">
      <Link href="/"><Logo /></Link>
      <h1 className="pt-6 text-3xl font-semibold tracking-tight">Privacy</h1>
      <p>Your wallet lists, notes and labels are visible only to you and to the people you explicitly invite. They never appear in public profiles, search engines or public APIs.</p>
      <h2 className="pt-2 font-semibold">The browser extension</h2>
      <p>The extension scans pages locally, only on sites you enable. To look up a label it sends the detected address and its format. To recognize X accounts it downloads the handles you may see and matches them in your browser, so we never learn which profiles you view. It does not send page content, page URLs or browsing history.</p>
      <h2 className="pt-2 font-semibold">What we store</h2>
      <p>Your account details, the records you create, and product usage counts such as how many wallets were tagged. We never request or store seed phrases, private keys or signed transactions.</p>
      <h2 className="pt-2 font-semibold">Your controls</h2>
      <p>You can export everything or delete your account at any time from Settings, and make a public profile private again whenever you like.</p>
    </main>
  );
}
