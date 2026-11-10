import Link from "next/link";
import { Logo } from "@/components/ui";
import { GENERATIONS } from "@/components/landing/versions";

export default function LandingVersions() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12 pb-24">
      <Logo className="text-lg" />
      <h1 className="mt-10 text-4xl font-semibold tracking-tight">Landing page versions</h1>
      <p className="mt-3 text-muted">The floating button in the bottom-right corner moves between versions. Click the round label to change rounds.</p>
      {GENERATIONS.map((g) => (
        <section key={g.id} className="mt-12">
          <h2 className="addr text-lg font-semibold text-accent">{g.id}</h2>
          <p className="mt-1 text-sm text-muted">{g.note}</p>
          <ol className="mt-4 divide-y divide-line border-y border-line">
            {g.versions.map((v, i) => (
              <li key={v.slug}>
                <Link href={`/landing/${g.id}/${v.slug}`} className="group flex gap-4 py-5">
                  <span className="addr pt-1 text-muted">{i + 1}</span>
                  <span>
                    <span className="text-lg font-semibold group-hover:text-accent">{v.name}</span>
                    <span className="mt-1 block text-muted">{v.idea}</span>
                    <span className="mt-1 block text-xs text-muted">{v.refs}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </main>
  );
}
