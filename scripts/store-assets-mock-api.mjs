// A stand-in for the TagAWallet API, used only when capturing Chrome Web Store screenshots.
// The real extension talks to it, so every chip, card and panel in the captures is the shipped UI.
import { createServer } from "node:http";

const L = (source, label, extra = {}) => ({
  source,
  provenance: { private: "Your private tag", verified: "Verified", shared: "Shared by Whale watch", community: "Published by the community" }[source],
  label, chain: "eth", tags: [], links: [], shared: source === "shared", ...extra,
});

// Addresses whose public identity is well known.
const KNOWN = {
  "0xd8da6bf26964af9d7eed9e03e53415d37aa96045": L("verified", "Vitalik Buterin", { tags: ["founder", "ens"], status: "trusted", entity: { id: "e1", name: "Vitalik Buterin", verification: "verified", linkedWallets: 3, relationship: "Founder" }, notes: "Ethereum co-founder. Primary public wallet.", links: [{ type: "ens", url: "https://app.ens.domains/vitalik.eth", label: "vitalik.eth" }] }),
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": L("verified", "USD Coin (USDC)", { tags: ["stablecoin", "token"], entity: { id: "e2", name: "Circle", verification: "verified", linkedWallets: 4, relationship: "Issuer" }, notes: "USDC token contract." }),
  "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": L("verified", "Wrapped Ether (WETH)", { tags: ["token"], notes: "WETH9 token contract." }),
  "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640": L("verified", "Uniswap V3: USDC/WETH 0.05%", { tags: ["dex", "pool"], entity: { id: "e3", name: "Uniswap", verification: "verified", linkedWallets: 12, relationship: "Pool" }, notes: "Deepest ETH/USDC pool on mainnet." }),
  "0x7a250d5630b4cf539739df2c5dacb4c659f2488d": L("verified", "Uniswap V2: Router", { tags: ["dex", "router"], entity: { id: "e3", name: "Uniswap", verification: "verified", linkedWallets: 12, relationship: "Router" } }),
};

// Everyone else gets a personal tag on roughly a third of addresses, so a page shows both tagged and untagged.
const PERSONAL = [
  ["Alice (OTC desk)", ["otc", "trusted"], "trusted", "Alice Chen", "Settles large swaps off-exchange. Always confirm the address on a call first."],
  ["Treasury multisig", ["dao", "multisig"], "trusted", "Orbit DAO", "4-of-7 Safe. Signers rotate quarterly."],
  ["Cold storage", ["mine"], "mine", undefined, "Hardware wallet, never connected to dApps."],
  ["Arb bot #2", ["bot", "mev"], "watchlist", "Unknown searcher", "Front-runs the same pools every block. Watching."],
  ["Airdrop farmer?", ["sybil"], "watchlist", undefined, "Fresh wallets funded from one source. Likely a cluster."],
  ["Sam — payroll", ["team"], "trusted", "Sam Okafor", "Pays contractors on the 1st and 15th."],
  ["Exchange deposit", ["cex"], undefined, "Exchange account", "Deposit address for my account."],
  ["Whale to watch", ["whale"], "watchlist", undefined, "Accumulating since March. Moves in 500 ETH chunks."],
];
const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const personal = (normalized) => {
  const h = hash(normalized);
  if (h % 2 !== 0) return [];
  const [label, tags, status, entity, notes] = PERSONAL[h % PERSONAL.length];
  return [L("private", label, { tags, status, notes, listName: "Whale watch", ...(entity ? { entity: { id: "p" + (h % 9), name: entity, verification: "unverified", linkedWallets: 1 + (h % 4) } } : {}) })];
};

const id = (n) => n.toString(16).padStart(24, "0");
const wallet = (n, address, displayLabel, extra = {}) => ({ id: id(n), address, chain: "eth", displayLabel, ...extra });
const WALLETS = [
  wallet(1, "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", "Vitalik Buterin", { status: "trusted", tags: ["founder"], lists: [{ id: id(101), name: "Public figures" }] }),
  wallet(2, "0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640", "Uniswap V3: USDC/WETH", { status: "trusted", tags: ["dex"], lists: [{ id: id(102), name: "Protocols" }] }),
  wallet(3, "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "USDC contract", { tags: ["stablecoin"], lists: [{ id: id(102), name: "Protocols" }] }),
  wallet(4, "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed", "Cold storage", { status: "mine", own: true, lists: [{ id: id(103), name: "My wallets" }] }),
  wallet(5, "0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359", "Alice (OTC desk)", { status: "trusted", tags: ["otc"], lists: [{ id: id(104), name: "Whale watch" }] }),
  wallet(6, "0xdbF03B407c01E7cD3CBea99509d93f8DDDC8C6FB", "Arb bot #2", { status: "watchlist", tags: ["bot"], lists: [{ id: id(104), name: "Whale watch" }] }),
];
const LISTS = [
  { id: id(104), name: "Whale watch", visibility: "private", role: "owner", walletCount: 18, shared: false, isPublic: false },
  { id: id(102), name: "Protocols", visibility: "private", role: "owner", walletCount: 42, shared: false, isPublic: false },
  { id: id(103), name: "My wallets", visibility: "private", role: "owner", walletCount: 5, shared: false, isPublic: false },
  { id: id(101), name: "Public figures", visibility: "shared", role: "editor", walletCount: 11, shared: true, isPublic: false },
];
const ENTITIES = [
  { id: "e1", name: "Vitalik Buterin", type: "individual", walletCount: 3, isPublic: true, verified: true },
  { id: "e3", name: "Uniswap", type: "protocol", walletCount: 12, isPublic: true, verified: true },
  { id: "e2", name: "Circle", type: "company", walletCount: 4, isPublic: true, verified: true },
];
const SETTINGS = { chipsEnabled: true, chipStyle: "badge", disabledSites: [], enabledSites: [], cloudSync: true, defaultListId: null, theme: "dark", showUnknown: true, pageBadge: true, panelMode: "float" };

const route = {
  "/api/extension/resolve": (body) => ({ results: (body.addresses ?? []).map((a) => ({ normalized: a.normalized, labels: KNOWN[a.normalized] ? [KNOWN[a.normalized]] : personal(a.normalized) })) }),
  "/api/extension/handles": () => ({ entries: [] }),
  "/api/extension/sites": () => ({ sites: [] }),
  "/api/extension/bootstrap": () => ({
    user: { displayName: "Gabriel", email: null }, lastListId: LISTS[0].id, settings: SETTINGS,
    lists: LISTS.map(({ id, name, visibility }) => ({ id, name, visibility })), entities: ENTITIES.map(({ id, name, type }) => ({ id, name, type })),
  }),
  "/api/extension/library": () => ({ lists: LISTS, entities: ENTITIES, recent: WALLETS, counts: { wallets: 76, lists: LISTS.length, entities: ENTITIES.length } }),
  "/api/extension/collection": (_b, url) => {
    const listId = url.searchParams.get("id");
    const list = LISTS.find((l) => l.id === listId);
    return { kind: "list", id: listId, name: list?.name ?? "List", role: "owner", own: true, total: WALLETS.length, wallets: WALLETS.filter((w) => w.lists?.some((l) => l.id === listId)) };
  },
  "/api/extension/search": () => ({ wallets: [], entities: [] }),
  "/api/extension/tags": () => ({ listName: "Whale watch", shared: false }),
  "/api/extension/settings": () => ({}),
  "/api/events": () => ({}),
};

export function startMockApi(port) {
  const server = createServer(async (req, res) => {
    const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
    if (req.method === "OPTIONS") { res.writeHead(204, cors).end(); return; }
    const url = new URL(req.url, `http://localhost:${port}`);
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString() || "{}") : {};
    const handler = route[url.pathname];
    res.writeHead(handler ? 200 : 404, { ...cors, "content-type": "application/json" });
    res.end(JSON.stringify(handler ? handler(body, url) : { error: "not found" }));
  });
  return new Promise((ok) => server.listen(port, () => ok(server)));
}
