import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/ui";
import { socialMetadata } from "@/lib/site";

const title = "API";
const description = "Look up wallet labels and manage lists with the TagAWallet HTTP API.";
export const metadata: Metadata = { title, description, ...socialMetadata(title, description) };

const ENDPOINTS: { path: string; what: string; params?: string }[] = [
  { path: "/api/v1/wallets", what: "Your wallets and those in lists shared with you, newest first.", params: "q, list, entity, tag, status, chain, limit (max 500)" },
  { path: "/api/v1/lists", what: "Your lists and the ones shared with you, with your role and a wallet count." },
  { path: "/api/v1/entities", what: "Your people and projects.", params: "q" },
  { path: "/api/v1/lookup", what: "Labels for up to 200 addresses or .eth names, exactly as the extension shows them.", params: "addresses (comma-separated)" },
];

export default function ApiDocs() {
  return (
    <main className="mx-auto w-full max-w-2xl space-y-4 px-4 py-8">
      <Link href="/"><Logo /></Link>
      <h1 className="pt-6 text-3xl font-semibold tracking-tight">API</h1>
      <p>A read-only API for your own TagAWallet data, for scripts, notebooks and bots. It follows the same privacy rules as the app: you see your own tags, lists shared with you and published profiles. Nobody else&apos;s private records, ever.</p>

      <h2 className="pt-2 font-semibold">Authentication</h2>
      <p>Create a key in <Link className="underline" href="/settings#api">Settings › API keys</Link>. It&apos;s shown once. Send it as a Bearer token:</p>
      <pre className="overflow-x-auto rounded-lg bg-card p-3 text-xs"><code>{`curl -H "Authorization: Bearer taw_…" \\
  "https://tagawallet.com/api/v1/lookup?addresses=0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"`}</code></pre>
      <p className="text-sm text-muted">Keys can only read. They can&apos;t sign in to the app, change anything or see account details. Revoke a key at any time and it stops working on the next request.</p>

      <h2 className="pt-2 font-semibold">Endpoints</h2>
      <ul className="space-y-3">
        {ENDPOINTS.map((e) => (
          <li key={e.path} className="rounded-lg bg-card p-3">
            <code className="text-sm font-medium">GET {e.path}</code>
            <p className="mt-1 text-sm">{e.what}</p>
            {e.params && <p className="mt-1 text-xs text-muted">Query: {e.params}</p>}
          </li>
        ))}
      </ul>

      <h2 className="pt-2 font-semibold">Limits and errors</h2>
      <p className="text-sm">300 requests a minute per key (120 for lookup). Errors are JSON with an <code>error</code> message: 401 for a missing or revoked key, 405 for anything but GET, 422 for bad input, 429 when you&apos;re over the limit.</p>
    </main>
  );
}
