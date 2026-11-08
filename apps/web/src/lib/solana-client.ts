/** Phantom and other Solana wallets that inject a provider with signMessage. */
export function solanaProvider(): any | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  const p = w.phantom?.solana ?? w.solana;
  return p && typeof p.signMessage === "function" ? p : null;
}

/** Signs a plain message with the connected Solana wallet. A signature only, never a transaction. */
export async function signWithSolana(message: string): Promise<{ address: string; signature: string }> {
  const p = solanaProvider();
  if (!p) throw new Error("No Solana wallet found. Install Phantom or another Solana wallet, then try again.");
  const { publicKey } = await p.connect();
  const { signature } = await p.signMessage(new TextEncoder().encode(message), "utf8");
  return { address: publicKey.toString(), signature: btoa(String.fromCharCode(...new Uint8Array(signature))) };
}
