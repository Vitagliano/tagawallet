import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { send } from "../lib/messages";
import { connectUrl, Logo, requestSites } from "../lib/ui";
import "../lib/page.css";

type Status = { connected: boolean; sites: string[]; apiBase: string };

function App() {
  const [status, setStatus] = useState<Status | null>(null), [granted, setGranted] = useState(false);
  const refresh = async () => {
    setStatus(await send<Status>({ type: "status" }));
    setGranted(((await chrome.permissions.getAll()).origins ?? []).length > 0);
  };
  useEffect(() => {
    void refresh();
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);
  if (!status) return null;
  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: "40px 16px", display: "grid", gap: 14 }}>
      <Logo />
      <h1 style={{ fontSize: 28, lineHeight: 1.15 }}>Welcome. Let&apos;s label your first wallet.</h1>
      <p style={{ margin: 0 }} className="muted">TagAWallet is not a wallet. It will never ask for a seed phrase, private key or transaction.</p>
      <section className="card">
        <h2 style={{ fontSize: 15 }}>1. Connect your account {status.connected && <span className="good">✓</span>}</h2>
        <p className="muted" style={{ margin: "4px 0 10px" }}>Your tags stay private to you. Nobody else sees them unless you share a list.</p>
        {!status.connected && <button className="primary" onClick={() => chrome.tabs.create({ url: connectUrl(status.apiBase) })}>Sign in or create an account</button>}
      </section>
      <section className="card">
        <h2 style={{ fontSize: 15 }}>2. Choose where it runs {granted && <span className="good">✓</span>}</h2>
        <p className="muted" style={{ margin: "4px 0 10px" }}>Allow the supported explorers, X and trading tools. Addresses are found in your browser, and page content is never uploaded. You can also enable sites one at a time from the toolbar icon.</p>
        <button onClick={async () => { await requestSites(status.sites); await refresh(); }}>Enable {status.sites.length} supported sites</button>
      </section>
      <section className="card">
        <h2 style={{ fontSize: 15 }}>3. Create a list and tag a wallet</h2>
        <p className="muted" style={{ margin: "4px 0 10px" }}>Try “My Wallets” or “Research”. Then click “Tag this wallet” next to any address on an enabled site.</p>
        <button onClick={() => chrome.tabs.create({ url: `${status.apiBase}/dashboard` })}>Open dashboard</button>
      </section>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
