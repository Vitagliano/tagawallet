import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { send } from "../lib/messages";
import { connectUrl, Logo, requestSites } from "../lib/ui";
import "../lib/page.css";

type Status = { connected: boolean; sites: string[]; apiBase: string };

// A well-known public address, so the first tag happens on a real page.
const SAMPLE = "https://etherscan.io/address/0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";

function Step({ n, title, done, children }: { n: number; title: string; done: boolean; children: React.ReactNode }) {
  return (
    <section className="card" style={{ opacity: done ? 0.7 : 1 }}>
      <h2 style={{ fontSize: 15 }}><span className={done ? "good" : "muted"}>{done ? "✓" : `${n}.`}</span> {title}</h2>
      {children}
    </section>
  );
}

function App() {
  const [status, setStatus] = useState<Status | null>(null), [granted, setGranted] = useState(false);
  const refresh = async () => {
    const st = await send<Status>({ type: "status" });
    setStatus(st);
    // Done only when the supported sites themselves are granted, not just any one origin.
    setGranted(st.sites.length > 0 && await chrome.permissions.contains({ origins: st.sites.map((h) => `https://${h}/*`) }).catch(() => false));
  };
  useEffect(() => {
    void refresh();
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);
  if (!status) return null;
  const ready = status.connected && granted;
  return (
    <main style={{ maxWidth: 520, margin: "0 auto", padding: "40px 16px", display: "grid", gap: 14 }}>
      <Logo />
      <h1 style={{ fontSize: 28, lineHeight: 1.15 }}>Two steps, then you&apos;re tagging.</h1>
      <p style={{ margin: 0 }} className="muted">TagAWallet is not a wallet. It will never ask for a seed phrase, private key or transaction.</p>
      <Step n={1} title="Connect your account" done={status.connected}>
        <p className="muted" style={{ margin: "4px 0 10px" }}>Your tags are private to you unless you share a list.</p>
        {!status.connected && <button className="primary" onClick={() => chrome.tabs.create({ url: connectUrl(status.apiBase) })}>Sign in or create an account</button>}
      </Step>
      <Step n={2} title="Turn it on for crypto sites" done={granted}>
        <p className="muted" style={{ margin: "4px 0 10px" }}>Explorers, X and trading tools. Addresses are found in your browser, and page content is never uploaded.</p>
        {!granted && <button className="primary" onClick={async () => { await requestSites(status.sites); await refresh(); }}>Turn on {status.sites.length} supported sites</button>}
      </Step>
      <section className="card" style={{ borderColor: ready ? "var(--accent)" : undefined }}>
        <h2 style={{ fontSize: 15 }}>Try it</h2>
        <p className="muted" style={{ margin: "4px 0 10px" }}>Open a sample address on Etherscan, then click the small tag next to it and give it a name.</p>
        <button className={ready ? "primary" : ""} disabled={!ready} onClick={() => chrome.tabs.create({ url: SAMPLE })}>Open a sample address</button>
      </section>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
