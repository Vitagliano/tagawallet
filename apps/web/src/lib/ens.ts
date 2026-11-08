import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";
import { normalize } from "viem/ens";
import { getDb } from "./db";

const HIT_TTL = 24 * 3600_000;
const MISS_TTL = 3600_000;
const MAX_LOOKUPS = 25;

type Entry = { _id: string; address: string | null; expiresAt: Date };

/**
 * Forward-resolves .eth names to addresses, so a name on a page can show the label of the wallet behind it.
 * Answers are cached for a day (an hour for names that don't resolve). Without ETH_RPC_URL only the cache
 * is read, so nothing is ever sent to a public RPC by default.
 */
export async function ensAddresses(names: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const wanted = [...new Set(names.filter((n) => n.endsWith(".eth")))];
  if (!wanted.length) return out;
  const db = await getDb();
  const cache = db.collection<Entry>("ens_cache");
  const now = new Date();
  const cached = await cache.find({ _id: { $in: wanted }, expiresAt: { $gt: now } }).toArray();
  for (const c of cached) if (c.address) out.set(c._id, c.address);
  const rpc = process.env.ETH_RPC_URL;
  const missing = wanted.filter((n) => !cached.some((c) => c._id === n)).slice(0, MAX_LOOKUPS);
  if (!rpc || !missing.length) return out;
  const client = createPublicClient({ chain: mainnet, transport: http(rpc, { timeout: 4000 }), batch: { multicall: true } });
  const answers = await Promise.all(missing.map(async (name) => {
    try { return [name, await client.getEnsAddress({ name: normalize(name) })] as const; }
    catch { return [name, null] as const; }
  }));
  await Promise.all(answers.map(([name, address]) => {
    if (address) out.set(name, address);
    return cache.updateOne({ _id: name }, { $set: { address: address ?? null, expiresAt: new Date(Date.now() + (address ? HIT_TTL : MISS_TTL)) } }, { upsert: true });
  }));
  return out;
}
