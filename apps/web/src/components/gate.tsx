import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { EXTENSION_HREF, EXTENSION_STORE_URL } from "@/lib/extension";

export function Gate({ signedIn }: { signedIn: boolean }) {
  const external = EXTENSION_STORE_URL.startsWith("http");

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6">
      <BrandMark className="w-[min(42vw,11rem)]" />
      <h1 className="mt-8 text-[clamp(2.5rem,8vw,4rem)] font-semibold tracking-tight">
        TagAWallet
      </h1>
      <div className="mt-10 grid w-full max-w-md grid-cols-1 gap-3 sm:grid-cols-2">
        <a
          href={EXTENSION_HREF}
          target={external ? "_blank" : undefined}
          rel={external ? "noopener" : undefined}
          className="inline-flex h-11 items-center justify-center rounded-xl bg-accent px-5 text-sm font-semibold leading-none text-accent-ink shadow-[inset_0_0_0_1px_rgb(0_0_0/0.2)] hover:opacity-90"
        >
          Download the extension
        </a>
        <Link
          href="/dashboard"
          className="inline-flex h-11 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--ink)_14%,var(--paper))] px-5 text-sm font-semibold leading-none shadow-[inset_0_0_0_1px_var(--line)] hover:bg-[color-mix(in_srgb,var(--ink)_20%,var(--paper))]"
        >
          {signedIn ? "Open dashboard" : "Join the dashboard"}
        </Link>
      </div>
    </main>
  );
}
