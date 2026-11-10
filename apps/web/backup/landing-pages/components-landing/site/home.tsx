import Link from "next/link";
import { CHAINS } from "@tagawallet/shared";
import { Experience } from "../v5/lookalike-6";
import { FootLinks } from "../shared";
import { InstallButton } from "./install-button";
import { MarkStory } from "./mark";
import { ReadingStage } from "./read";
import { Wordmark } from "./wordmark";
import "../landing.css";

/* The home page, in three acts. First you feel the problem, then you read a page the way the extension shows it,
   then the mark explains how the pieces fit. The install button is at the end of each act. */

export function HomeLanding({ signedIn }: { signedIn: boolean }) {
  return (
    <>
      <main>
        <Experience
          signedIn={signedIn}
          allowSkip
          headerCta={<InstallButton variant="link" hideOnPhone />}
          cta={<InstallButton />}
          doneBody="A free browser extension that puts the name beside the address, on every explorer, post and send form you open. Private by default."
        />
        <ReadingStage />
        <MarkStory />
        <section className="mx-auto w-full max-w-5xl px-5 pb-24 pt-8" aria-label="Not a wallet">
          <div className="rounded-xl bg-wash p-6 md:p-8">
            <h2 className="font-semibold">Despite the name, TagAWallet is not a wallet.</h2>
            <p className="mt-1.5 max-w-2xl text-muted">It holds no funds and never asks for a seed phrase, private key or transaction signature. The extension reads only the sites you turn it on for, sends only the addresses it needs names for and the tags you save, and never uploads page content or history. Read the <Link href="/privacy" className="underline underline-offset-4 hover:text-ink">privacy policy</Link>.</p>
          </div>
        </section>
      </main>
      <footer className="overflow-hidden bg-[#EE6A42] text-[#1a0d07]">
        <div className="mx-auto w-full max-w-6xl px-4 pb-6 pt-20">
          <p className="max-w-3xl text-5xl font-semibold leading-[1] tracking-tight md:text-7xl">Tag your first wallet.</p>
          <div className="mt-7 flex flex-wrap items-center gap-5">
            <InstallButton variant="ink" />
            <Link href={signedIn ? "/dashboard" : "/signup"} className="font-medium underline-offset-4 hover:underline">{signedIn ? "Open your dashboard" : "Start on the web"} <span className="cta-arrow inline-block" aria-hidden>→</span></Link>
          </div>
          <p className="mt-4 text-sm font-medium opacity-80">Free · Chrome, Brave and Edge · Firefox and Safari aren&apos;t supported yet</p>
          <p className="mt-14 text-sm font-medium">{Object.values(CHAINS).map((c) => c.name).join("  ·  ")}</p>
          <div className="mt-3 flex flex-wrap gap-4 pb-14 text-sm">
            <FootLinks />
            <Link href="/login" className="hover:underline">Sign in</Link>
            <Link href="/docs/api" className="hover:underline">API</Link>
          </div>
        </div>
        <Wordmark />
      </footer>
    </>
  );
}
