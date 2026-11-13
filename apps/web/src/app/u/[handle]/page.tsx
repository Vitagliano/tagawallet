import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { publicUserPage } from "@/lib/public-user";
import { Logo } from "@/components/ui";
import { socialMetadata } from "@/lib/site";

type Props = { params: Promise<{ handle: string }> };
const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const u = await publicUserPage((await params).handle);
  if (!u) return { robots: { index: false } };
  const title = `${u.name} (@${u.handle})`;
  const description = u.bio || `Contacts and lists ${u.name} published on TagAWallet.`;
  return { title, description, ...socialMetadata(title, description), robots: { index: false, follow: false } };
}

/** Someone's public page: the contacts and lists they chose to publish. Everything else they have stays private. */
export default async function UserPage({ params }: Props) {
  const u = await publicUserPage((await params).handle);
  if (!u) notFound();
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <Link href="/"><Logo /></Link>
      <header className="mt-8 flex items-center gap-4">
        <span aria-hidden className="grid size-14 shrink-0 place-items-center rounded-full bg-accent text-lg font-semibold text-accent-ink">{initials(u.name)}</span>
        <div className="min-w-0">
          <h1 className="text-3xl leading-tight font-semibold tracking-tight">{u.name}</h1>
          <p className="text-sm text-muted">@{u.handle}</p>
        </div>
      </header>
      {u.bio && <p className="mt-4 whitespace-pre-wrap text-pretty">{u.bio}</p>}
      <p className="mt-4 text-sm text-pretty text-muted">These are {u.name}&apos;s names for these wallets, published by them. They aren&apos;t claims of ownership.</p>

      <section className="mt-8" aria-labelledby="contacts-h">
        <h2 id="contacts-h" className="mb-2 font-semibold">Contacts <span className="text-sm font-normal text-muted">{u.contacts.length}</span></h2>
        {u.contacts.length ? (
          <ul className="divide-y divide-line rounded-xl border border-line bg-card">
            {u.contacts.map((c) => (
              <li key={c.slug}>
                <Link href={`/p/${c.slug}`} className="flex items-center gap-3 px-4 py-3 hover:bg-wash/60">
                  {c.avatarUrl
                    ? <img src={c.avatarUrl} alt="" width={36} height={36} className="size-9 rounded-full object-cover" referrerPolicy="no-referrer" />
                    : <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-wash text-xs font-semibold text-muted">{initials(c.name)}</span>}
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{c.name}{c.verified && <span className="ml-2 rounded-full bg-good/15 px-2 py-0.5 text-xs font-medium text-good">✓ Verified</span>}</span>
                    <span className="block truncate text-xs text-muted">{c.kind} · {c.wallets} wallet{c.wallets === 1 ? "" : "s"}{c.description ? ` · ${c.description}` : ""}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted">No public contacts yet.</p>}
      </section>

      <section className="mt-8" aria-labelledby="lists-h">
        <h2 id="lists-h" className="mb-2 font-semibold">Lists <span className="text-sm font-normal text-muted">{u.lists.length}</span></h2>
        {u.lists.length ? (
          <ul className="divide-y divide-line rounded-xl border border-line bg-card">
            {u.lists.map((l) => (
              <li key={l.id}>
                <Link href={`/l/${l.id}`} className="block px-4 py-3 hover:bg-wash/60">
                  <span className="block font-medium">{l.name}</span>
                  <span className="block truncate text-xs text-muted">{l.wallets} wallet{l.wallets === 1 ? "" : "s"}{l.description ? ` · ${l.description}` : ""}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted">No public lists yet.</p>}
      </section>
    </div>
  );
}
