import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/ui";
import { socialMetadata } from "@/lib/site";

const title = "Terms";
const description = "Terms of use for TagAWallet — an organizational tool, not a wallet or financial advice.";
export const metadata: Metadata = { title, description, ...socialMetadata(title, description) };

export default function Terms() {
  return (
    <main className="mx-auto w-full max-w-2xl space-y-4 px-4 py-8">
      <Link href="/"><Logo /></Link>
      <h1 className="pt-6 text-3xl font-semibold tracking-tight">Terms</h1>
      <p>TagAWallet is an organizational tool. It does not hold funds and is not financial advice. Labels may be wrong, so check a wallet&apos;s identity before relying on it.</p>
      <p>Only publish identity claims that are yours to make. Don&apos;t publish private personal information or attribute a wallet to a private individual without verification. Moderators may annotate or remove public profiles, and may restrict accounts for repeated abuse.</p>
    </main>
  );
}
