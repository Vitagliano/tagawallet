import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CHAINS, LINK_TYPE_LABELS, linkHref, truncateAddress, type ChainId, type LinkType } from "@tagawallet/shared";
import { publicProfile } from "@/lib/entities";
import { track } from "@/lib/access";
import { Logo } from "@/components/ui";
import { ReportButton } from "./report";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await publicProfile((await params).slug);
  if (!p) return { robots: { index: false } };
  // Indexing is a second, separate opt-in from publishing.
  return { title: p.name, description: p.description.slice(0, 160), robots: { index: p.indexable, follow: false } };
}

const STATUS = {
  verified: { label: "✓ Verified", cls: "bg-good/15 text-good", text: "The owner proved control of the channels listed below." },
  self_claimed: { label: "Self-claimed", cls: "bg-warn/15 text-warn", text: "The owner says this is theirs. TagAWallet has not confirmed it." },
};
const PROOF: Record<string, string> = { x_post: "X post", dns: "DNS record", meta: "website tag", ens: "ENS record" };

export default async function Profile({ params }: Props) {
  const p = await publicProfile((await params).slug);
  if (!p) notFound();
  void track("public_profile_view");
  const status = STATUS[p.verification as keyof typeof STATUS] ?? STATUS.self_claimed;
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <Link href="/"><Logo /></Link>
      <header className="mt-8 flex items-start gap-4">
        {p.avatarUrl && <img src={p.avatarUrl} alt="" width={56} height={56} className="size-14 rounded-xl border border-line object-cover" referrerPolicy="no-referrer" />}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-semibold tracking-tight">{p.name}</h1>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.cls}`}>{status.label}</span>
          </div>
          <p className="mt-1 text-sm capitalize text-muted">{p.type}</p>
        </div>
      </header>
      {p.description && <p className="mt-4 whitespace-pre-wrap">{p.description}</p>}
      {p.annotation && <p className="mt-4 rounded-md bg-warn/10 p-3 text-sm"><b>Moderator note:</b> {p.annotation}</p>}
      <p className="mt-4 text-sm text-muted">
        {status.text}
        {p.proofs.length > 0 && <> Proven: {p.proofs.map((x) => `${PROOF[x.method] ?? x.method} for ${x.target}`).join(", ")}.</>}
      </p>

      {p.links.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 font-semibold">Links</h2>
          <ul className="divide-y divide-line rounded-xl border border-line bg-card">
            {p.links.map((l: { type: string; url: string; label: string; status: string }) => (
              <li key={l.url} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <a className="truncate underline" href={linkHref(l.type as LinkType, l.url)} rel="noreferrer noopener nofollow ugc" target="_blank">{l.label || LINK_TYPE_LABELS[l.type as LinkType]}</a>
                <span className="shrink-0 text-xs capitalize text-muted">{l.status}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="mt-8">
        <h2 className="mb-2 font-semibold">Wallets</h2>
        {p.wallets.length ? (
          <ul className="divide-y divide-line rounded-xl border border-line bg-card">
            {p.wallets.map((w) => (
              <li key={`${w.chain}:${w.address}`} className="px-4 py-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <a className="addr underline" title={w.address} href={CHAINS[w.chain as ChainId].explorer + w.address} rel="noreferrer noopener nofollow" target="_blank">{truncateAddress(w.address, 10, 8)}</a>
                  <span className="text-xs text-muted">{CHAINS[w.chain as ChainId].name} · {w.relationship.replace("_", " ")}</span>
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-2 text-xs text-muted">
                  <span>Source: {w.source}</span>
                  <ReportButton entityId={p.id} slug={p.slug} link={{ id: w.linkId, address: w.address }} />
                </div>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted">No public wallets yet.</p>}
      </section>
      <footer className="mt-8 flex items-center justify-between gap-3 border-t border-line pt-4 text-sm text-muted">
        <span>Something wrong here?</span>
        <ReportButton entityId={p.id} slug={p.slug} />
      </footer>
    </div>
  );
}
