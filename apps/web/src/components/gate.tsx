import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { SITE_TAGLINE } from "@/lib/site";

const GITHUB_URL = "https://github.com/Vitagliano/tagawallet";
const PORTFOLIO_URL = "https://vitagliano.me";

export function Gate ({ signedIn }: { signedIn: boolean }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6">
      <BrandMark className="w-[min(42vw,11rem)]" />
      <h1 className="mt-8 text-[clamp(2.5rem,8vw,4rem)] font-semibold tracking-tight">
        TagAWallet
      </h1>
      <p className="mt-3 max-w-md text-center text-base text-muted sm:text-lg">
        {SITE_TAGLINE}
      </p>
      <div className="mt-8 grid w-full max-w-md grid-cols-1 gap-3 sm:grid-cols-2">
        <Link
          href="/extension"
          className="inline-flex h-11 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--ink)_10%,var(--paper))] px-5 text-sm font-semibold leading-none text-muted shadow-[inset_0_0_0_1px_var(--line)]"
          aria-label="Chrome extension coming soon"
        >
          Extension soon
        </Link>
        <Link
          href="/dashboard"
          className="inline-flex h-11 items-center justify-center rounded-xl bg-accent px-5 text-sm font-semibold leading-none text-accent-ink shadow-[inset_0_0_0_1px_rgb(0_0_0/0.2)] hover:opacity-90"
        >
          {signedIn ? "Open dashboard" : "Join the dashboard"}
        </Link>
      </div>
      <p className="mt-8 max-w-md text-center text-sm leading-relaxed text-muted">
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-[color-mix(in_srgb,var(--muted)_45%,transparent)] underline-offset-4 hover:text-ink"
        >
          Open source on GitHub
        </a>
        <span className="mx-2 text-[color-mix(in_srgb,var(--muted)_55%,transparent)]" aria-hidden>
          ·
        </span>
        <span>
          Project built by{" "}
          <a
            href={PORTFOLIO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-ink underline decoration-[color-mix(in_srgb,var(--muted)_45%,transparent)] underline-offset-4 hover:opacity-80"
          >
            @gabrielrvita
          </a>
        </span>
      </p>
    </main>
  );
}
