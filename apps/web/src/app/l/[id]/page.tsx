import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CHAINS, truncateAddress, type ChainId } from "@tagawallet/shared";
import { publicList } from "@/lib/public-user";
import { Logo } from "@/components/ui";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const l = await publicList((await params).id);
  if (!l) return { robots: { index: false } };
  return { title: `${l.name} · ${l.publishedBy.name}`, description: l.description || `A list of wallets published by ${l.publishedBy.name}.`, robots: { index: false, follow: false } };
}

/** A published list: the names its owner gave these wallets. Notes and wallets other members added aren't shown. */
export default async function ListPage({ params }: Props) {
  const l = await publicList((await params).id);
  if (!l) notFound();
  const by = l.publishedBy.handle ? <Link className="underline-offset-2 hover:underline" href={`/u/${l.publishedBy.handle}`}>{l.publishedBy.name}</Link> : l.publishedBy.name;
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <Link href="/"><Logo /></Link>
      <header className="mt-8">
        <p className="text-sm text-muted">Public list · published by {by}</p>
        <h1 className="mt-1 text-3xl leading-tight font-semibold tracking-tight">{l.name}</h1>
        {l.description && <p className="mt-2 whitespace-pre-wrap text-pretty">{l.description}</p>}
      </header>
      <section className="mt-8" aria-labelledby="w-h">
        <h2 id="w-h" className="mb-2 font-semibold">Wallets <span className="text-sm font-normal text-muted">{l.wallets.length}</span></h2>
        {l.wallets.length ? (
          <ul className="divide-y divide-line rounded-xl border border-line bg-card">
            {l.wallets.map((w) => (
              <li key={`${w.chain}:${w.address}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                <span className="min-w-0">
                  <span className="block font-medium">{w.name || <span className="text-muted">Unnamed</span>}</span>
                  <Link className="addr text-xs text-muted underline-offset-2 hover:underline" href={`/a/${encodeURIComponent(w.address)}`} title={w.address}>{truncateAddress(w.address, 8, 6)}</Link>
                  <span className="text-xs text-muted"> · {CHAINS[w.chain as ChainId]?.name ?? w.chain}</span>
                </span>
                {w.tags.length > 0 && <span className="flex flex-wrap gap-1">{w.tags.slice(0, 4).map((t) => <span key={t} className="rounded-full bg-wash px-2 py-0.5 text-xs text-muted">{t}</span>)}</span>}
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted">Nothing here yet.</p>}
      </section>
      <p className="mt-6 text-xs text-pretty text-muted">These are {l.publishedBy.name}&apos;s names for these wallets. They aren&apos;t claims of ownership, and TagAWallet hasn&apos;t checked them.</p>
    </div>
  );
}
