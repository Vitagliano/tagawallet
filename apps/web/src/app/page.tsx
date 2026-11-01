import Link from "next/link";
import { Logo } from "@/components/ui";
import { currentUser } from "@/lib/session";

function Chip({ source, name, tone }: { source: string; name: string; tone: string }) {
  return <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-xs font-medium ${tone}`}>{name}<span className="font-normal opacity-70">{source}</span></span>;
}

const ROWS = [
  { addr: "0x28C6…1d60", chip: <Chip name="Exchange hot wallet" source="Verified" tone="border-good/40 bg-good/10 text-good" />, age: "2 min", value: "1,204.5 ETH" },
  { addr: "0x7a25…488D", chip: <Chip name="Alice, OTC desk" source="Your private tag" tone="border-line bg-wash text-ink" />, age: "9 min", value: "88.0 ETH" },
  { addr: "0x1f98…F984", chip: <Chip name="DAO treasury" source="Shared by Research" tone="border-warn/40 bg-warn/10 text-warn" />, age: "14 min", value: "310.2 ETH" },
  { addr: "0xdEAD…bEEF", chip: <span className="rounded-md border border-dashed border-line px-1.5 py-0.5 text-xs text-muted">Tag this wallet</span>, age: "21 min", value: "0.4 ETH" },
];

const POINTS = [
  { title: "Private by default", body: "Lists, notes and labels are yours alone until you invite someone. There is no public feed of what you're researching." },
  { title: "One entity, many wallets", body: "Group every address of a person, project, DAO or exchange across chains, with the links that back it up." },
  { title: "Every label shows its source", body: "Your private tag, a shared list, a self-claim or a verified profile. You always know who is saying what." },
  { title: "Where you already work", body: "Chips appear next to addresses on explorers, X and trading tools you enable. Page content never leaves your browser." },
];

export default async function Landing() {
  const user = await currentUser();
  return (
    <div className="mx-auto w-full max-w-5xl px-4">
      <header className="flex items-center justify-between py-5">
        <Logo className="text-lg" />
        <nav className="flex items-center gap-3 text-sm">
          {user ? <Link href="/dashboard" className="rounded-md bg-accent px-3 py-2 font-medium text-accent-ink">Open dashboard</Link> : (
            <>
              <Link href="/login" className="hover:underline">Sign in</Link>
              <Link href="/signup" className="rounded-md bg-accent px-3 py-2 font-medium text-accent-ink">Get started</Link>
            </>
          )}
        </nav>
      </header>
      <main>
        <section className="py-14 md:py-20">
          <h1 className="max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tight md:text-6xl">Know who&apos;s behind every wallet.</h1>
          <p className="mt-5 max-w-xl text-lg text-muted">Privately tag addresses, link socials, group related wallets, and recognize identities wherever you research and trade.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/signup" className="rounded-md bg-accent px-4 py-2.5 font-medium text-accent-ink">Start tagging, it&apos;s free</Link>
          </div>
        </section>
        <section aria-label="Example of inline tags on an explorer" className="overflow-hidden rounded-xl border border-line bg-card">
          <div className="flex items-center gap-2 border-b border-line px-4 py-2.5 text-xs text-muted">
            <span className="size-2.5 rounded-full bg-line" /><span className="size-2.5 rounded-full bg-line" /><span className="size-2.5 rounded-full bg-line" />
            <span className="ml-2">an explorer you already use</span>
          </div>
          <ul className="divide-y divide-line text-sm">
            {ROWS.map((r) => (
              <li key={r.addr} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
                <span className="addr">{r.addr}</span>{r.chip}
                <span className="ml-auto text-xs text-muted">{r.value} · {r.age} ago</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="grid gap-x-10 gap-y-8 py-16 sm:grid-cols-2">
          {POINTS.map((p) => (
            <div key={p.title}>
              <h2 className="font-semibold">{p.title}</h2>
              <p className="mt-1.5 text-muted">{p.body}</p>
            </div>
          ))}
        </section>
        <section className="rounded-xl bg-wash p-6">
          <h2 className="font-semibold">TagAWallet is not a wallet.</h2>
          <p className="mt-1.5 max-w-2xl text-muted">It holds no funds and will never ask for your seed phrase, private key or a transaction signature. Anyone asking for those in our name is not us.</p>
        </section>
      </main>
      <footer className="flex flex-wrap gap-4 py-8 text-sm text-muted">
        <span>© {new Date().getFullYear()} TagAWallet</span>
        <Link href="/privacy" className="hover:underline">Privacy</Link>
        <Link href="/terms" className="hover:underline">Terms</Link>
      </footer>
    </div>
  );
}
