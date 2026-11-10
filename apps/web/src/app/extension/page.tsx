import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/ui";
import { EXTENSION_STORE_URL } from "@/lib/extension";
import { currentUser } from "@/lib/session";

export const metadata: Metadata = { title: "Get the extension", robots: { index: false } };

/** The install link behind every "Add to Chrome" button. Goes straight to the store once the listing is live. */
export default async function Page() {
  if (EXTENSION_STORE_URL) redirect(EXTENSION_STORE_URL);
  const user = await currentUser();
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10">
      <Link href="/" className="mb-8"><Logo className="text-lg" /></Link>
      <h1 className="text-2xl font-semibold tracking-tight">The extension is almost here.</h1>
      <p className="mt-3 text-muted">TagAWallet for Chrome, Brave and Edge is on its way to the Chrome Web Store. Set up your lists on the web now, and they&apos;ll be waiting in your browser the moment it lands.</p>
      <Link href={user ? "/dashboard" : "/signup"} className="mt-6 inline-flex h-11 w-fit items-center rounded-xl bg-accent px-5 font-semibold text-accent-ink hover:opacity-90">
        {user ? "Open your dashboard" : "Create a free account"}
      </Link>
      <details className="mt-10 text-sm text-muted">
        <summary className="cursor-pointer font-medium text-ink">Testing a build?</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>Open <span className="addr">chrome://extensions</span> and turn on Developer mode.</li>
          <li>Choose Load unpacked and pick the extension&apos;s <span className="addr">dist</span> folder.</li>
          <li>Click the TagAWallet icon and connect this account.</li>
        </ol>
      </details>
      <p className="mt-10 text-xs text-muted">TagAWallet is not a wallet. It holds no funds and never asks for a seed phrase, private key or transaction.</p>
    </main>
  );
}
