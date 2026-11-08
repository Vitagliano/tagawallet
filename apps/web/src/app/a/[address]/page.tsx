import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CHAINS, CHAIN_IDS, truncateAddress, type ChainId } from "@tagawallet/shared";
import { publicAddress } from "@/lib/public-address";
import { currentUser } from "@/lib/session";
import { track } from "@/lib/access";
import { Logo } from "@/components/ui";

type Props = { params: Promise<{ address: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const a = await publicAddress((await params).address);
  if (!a) return { robots: { index: false } };
  const who = a.claims[0]?.name;
  return {
    title: who ? `${who} · ${truncateAddress(a.input)}` : truncateAddress(a.input),
    description: who ? `Public names for ${a.input} on TagAWallet: ${a.claims.map((c) => c.name).join(", ")}.` : `What TagAWallet knows publicly about ${a.input}.`,
    robots: { index: a.indexable, follow: a.indexable },
  };
}

const relationship = (r: string | null) => (r ? r.replace("_", " ") : "associated");

/** Anyone can check an address: only names people published (contacts and lists) appear, never anyone's private names. */
export default async function AddressPage({ params }: Props) {
  const [a, user] = await Promise.all([publicAddress((await params).address), currentUser()]);
  if (!a) notFound();
  void track("public_address_view");
  const address = a.resolved ?? a.input;
  const explorers = a.kind === "ens" ? [] : CHAIN_IDS.filter((c) => CHAINS[c].family === a.kind).slice(0, 3);
  const save = `/dashboard?add=${encodeURIComponent(address)}`;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <Link href="/"><Logo /></Link>
      <header className="mt-8">
        <p className="text-sm text-muted">{a.kind === "ens" ? "ENS name" : a.kind === "evm" ? "EVM address" : a.kind === "solana" ? "Solana address" : "Bitcoin address"}</p>
        <h1 className="addr mt-1 text-xl leading-snug font-semibold break-all">{a.input}</h1>
        {a.resolved && <p className="addr mt-1 text-sm break-all text-muted">Points to {a.resolved}</p>}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {explorers.map((c) => <a key={c} className="text-muted underline-offset-2 hover:text-ink hover:underline" href={CHAINS[c as ChainId].explorer + address} target="_blank" rel="noreferrer noopener nofollow">{CHAINS[c as ChainId].name} explorer ↗</a>)}
        </div>
      </header>

      <section className="mt-8" aria-labelledby="claims-h">
        <h2 id="claims-h" className="mb-2 font-semibold">{a.claims.length ? "Public names" : "No public names"}</h2>
        {a.claims.length ? (
          <ul className="divide-y divide-line rounded-xl border border-line bg-card">
            {a.claims.map((c) => (
              <li key={`${c.key}:${c.chain}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <span className="min-w-0">
                  {c.slug ? <Link className="font-medium underline-offset-2 hover:underline" href={`/p/${c.slug}`}>{c.name}</Link> : <span className="font-medium">{c.name}</span>}
                  {c.verified && <span className="ml-2 rounded-full bg-good/15 px-2 py-0.5 text-xs font-medium text-good">✓ Verified</span>}
                  <span className="mt-0.5 block text-xs text-muted">
                    Published by {c.publishedBy?.handle ? <Link className="underline-offset-2 hover:underline" href={`/u/${c.publishedBy.handle}`}>{c.publishedBy.name}</Link> : c.publishedBy?.name ?? "a TagAWallet user"}
                    {c.listName ? <> in the list “{c.listName}”</> : <> · <span className="capitalize">{relationship(c.relationship)}</span></>}
                    {" · "}{CHAINS[c.chain as ChainId]?.name ?? c.chain}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl border border-line bg-card px-4 py-3 text-sm text-pretty text-muted">
            Nobody has published a name for this address. That doesn&apos;t make it safe or unsafe: it just means nobody has said publicly whose it is.
          </p>
        )}
        <p className="mt-3 text-xs text-pretty text-muted">
          These are names people chose to publish, shown with who published them. They aren&apos;t claims of ownership, and TagAWallet hasn&apos;t checked them unless marked &quot;Verified&quot;. Names people keep for themselves are never shown.
        </p>
      </section>

      <section className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-card px-4 py-3 text-sm">
        <span className="text-pretty">{user ? "Keep your own name and notes for this address." : "Name this address for yourself and see it next to addresses across the web."}</span>
        <Link href={user ? save : `/signup?next=${encodeURIComponent(save)}`} className="inline-flex min-h-9 items-center rounded-lg bg-accent px-3 font-semibold text-accent-ink hover:opacity-90">
          {user ? "Save to my wallets" : "Start tagging, it's free"}
        </Link>
      </section>
    </div>
  );
}
