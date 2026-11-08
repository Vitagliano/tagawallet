import { lookup, resolveTxt } from "node:dns/promises";
import { isIP } from "node:net";
import { createPublicClient, http, verifyMessage } from "viem";
import { mainnet } from "viem/chains";
import { normalize } from "viem/ens";
import { isValidSolanaAddress, sanitizeUrl } from "@tagawallet/shared";
import { verifySolanaSignature } from "./solana";

export const verifyToken = (code: string) => `tagawallet-verify=${code}`;
export const signatureMessage = (entity: string, address: string, code: string) =>
  `I control ${address} and claim it for "${entity}" on TagAWallet.\n\nThis is not a transaction and costs nothing.\n\nCode: ${code}`;

function isPrivateIp(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v6 = ip.toLowerCase();
    return v6 === "::1" || v6 === "::" || /^(fc|fd|fe8|fe9|fea|feb)/.test(v6) || v6.startsWith("::ffff:") && isPrivateIp(v6.slice(7));
  }
  const [a, b] = ip.split(".").map(Number) as [number, number];
  return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

/** Fetches a user-supplied site safely: public addresses only, no redirects, bounded size and time. */
export async function safeFetchText(input: string, maxBytes = 500_000): Promise<string | null> {
  const url = sanitizeUrl(input);
  if (!url) return null;
  const { hostname, protocol } = new URL(url);
  if (protocol !== "https:") return null;
  const answers = await lookup(hostname, { all: true }).catch(() => []);
  if (!answers.length || answers.some((a) => isPrivateIp(a.address))) return null;
  const res = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(6000), headers: { "User-Agent": "TagAWalletVerifier/1.0" } }).catch(() => null);
  if (!res?.ok || !res.body) return null;
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value); size += value.length;
  }
  await reader.cancel().catch(() => {});
  return Buffer.concat(chunks).toString("utf8");
}

export async function checkDns(hostname: string, code: string) {
  const name = hostname.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(name)) return false;
  const records = await resolveTxt(name).catch(() => [] as string[][]);
  return records.some((r) => r.join("").includes(verifyToken(code)));
}

export async function checkMeta(site: string, code: string) {
  const html = await safeFetchText(site);
  if (!html) return false;
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  return tags.some((t) => /name=["']tagawallet-verify["']/i.test(t) && t.includes(`content="${code}"`));
}

export async function checkEns(name: string, code: string) {
  const client = createPublicClient({ chain: mainnet, transport: http(process.env.ETH_RPC_URL || undefined, { timeout: 8000 }) });
  const value = await client.getEnsText({ name: normalize(name), key: "tagawallet-verify" }).catch(() => null);
  return value === code;
}

/** Reads the post through X's public oEmbed endpoint, so no API key is needed to verify. */
export async function checkXPost(postUrl: string, handleUrl: string, code: string) {
  const url = sanitizeUrl(postUrl);
  if (!url) return false;
  const post = new URL(url);
  if (!/^(www\.)?(x|twitter)\.com$/.test(post.hostname)) return false;
  const [, handle, kind] = post.pathname.split("/");
  if (kind !== "status" || !handle) return false;
  const expected = new URL(handleUrl).pathname.split("/")[1];
  if (!expected || expected.toLowerCase() !== handle.toLowerCase()) return false;
  const res = await fetch(`https://publish.x.com/oembed?omit_script=1&url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(6000) }).catch(() => null);
  if (!res?.ok) return false;
  const data = await res.json().catch(() => null);
  const authorOk = String(data?.author_url ?? "").toLowerCase().endsWith(`/${handle.toLowerCase()}`);
  return authorOk && String(data?.html ?? "").includes(code);
}

export async function checkSignature(address: string, message: string, signature: string) {
  if (isValidSolanaAddress(address)) return verifySolanaSignature(address, message, signature);
  if (!/^0x[0-9a-f]+$/i.test(signature)) return false;
  return verifyMessage({ address: address as `0x${string}`, message, signature: signature as `0x${string}` }).catch(() => false);
}
