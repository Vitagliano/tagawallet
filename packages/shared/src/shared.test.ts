import { describe, expect, it } from "vitest";
import { detectAddresses, isValidAddress, normalizeAddress, normalizeLink, sanitizeUrl, toChecksumAddress, xHandleFromPath, xHandleFromUrl, parsePastedAddress, walletCreateSchema } from "./index";

const CHECKSUMMED = "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed";
const SOL = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM";

describe("addresses", () => {
  it("checksums per EIP-55", () => {
    expect(toChecksumAddress(CHECKSUMMED.toLowerCase())).toBe(CHECKSUMMED);
    expect(isValidAddress(CHECKSUMMED, "ethereum")).toBe(true);
    expect(isValidAddress(CHECKSUMMED.toLowerCase(), "base")).toBe(true);
    expect(isValidAddress(CHECKSUMMED.replace("aA", "Aa"), "ethereum")).toBe(false);
  });
  it("validates Solana and Bitcoin", () => {
    expect(isValidAddress(SOL, "solana")).toBe(true);
    expect(isValidAddress("0OIl" + SOL.slice(4), "solana")).toBe(false);
    expect(isValidAddress("1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa", "bitcoin")).toBe(true);
    expect(isValidAddress("1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNb", "bitcoin")).toBe(false);
    expect(isValidAddress("bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq", "bitcoin")).toBe(true);
    expect(isValidAddress("bc1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqkedrcr", "bitcoin")).toBe(true);
    expect(isValidAddress("bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdx", "bitcoin")).toBe(false);
  });
  it("normalizes only case-insensitive formats", () => {
    expect(normalizeAddress(CHECKSUMMED, "evm")).toBe(CHECKSUMMED.toLowerCase());
    expect(normalizeAddress(SOL, "solana")).toBe(SOL);
    expect(normalizeAddress("BC1QAR0SRRR7XFKVY5L643LYDNW9RE59GTZZWF5MDQ", "bitcoin")).toBe("bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq");
  });
  it("reports a checksum error in zod", () => {
    const r = walletCreateSchema.safeParse({ address: CHECKSUMMED.replace("aA", "Aa"), chain: "ethereum" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toMatch(/Checksum/);
  });
});

describe("detection", () => {
  it("finds each format in prose", () => {
    const text = `send to ${CHECKSUMMED}, or ${SOL} and vitalik.eth or bonfida.sol then 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa`;
    expect(detectAddresses(text).map((d) => d.kind).sort()).toEqual(["bitcoin", "ens", "evm", "sns", "solana"]);
  });
  it("ignores tx hashes and longer strings", () => {
    const hash = "0x" + "ab".repeat(32);
    expect(detectAddresses(`tx ${hash}`)).toEqual([]);
    expect(detectAddresses(`x${CHECKSUMMED}`)).toEqual([]);
    expect(detectAddresses(`${CHECKSUMMED}ff`)).toEqual([]);
  });
  it("ignores bad checksums and ordinary long words", () => {
    expect(detectAddresses(CHECKSUMMED.replace("aA", "Aa"))).toEqual([]);
    expect(detectAddresses("pneumonoultramicroscopicsilicovolcanoconiosis and supercalifragilisticexpialidocious")).toEqual([]);
  });
  it("dedupes case variants", () => {
    expect(detectAddresses(`${CHECKSUMMED} ${CHECKSUMMED.toLowerCase()}`)).toHaveLength(1);
  });
  it("parses pasted values", () => {
    expect(parsePastedAddress(` ${CHECKSUMMED} `)?.kind).toBe("evm");
    expect(parsePastedAddress("nope")).toBeNull();
  });
});

describe("urls", () => {
  it("blocks dangerous schemes", () => {
    for (const bad of ["javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html,x", "vbscript:x", "file:///etc/passwd", " java\tscript:alert(1)", "https://user:pw@evil.com"]) {
      expect(sanitizeUrl(bad)).toBeNull();
    }
  });
  it("accepts and upgrades plain hosts", () => {
    expect(sanitizeUrl("uniswap.org")).toBe("https://uniswap.org/");
  });
  it("normalizes handles and rejects host spoofing", () => {
    expect(normalizeLink("x", "@Uniswap")).toBe("https://x.com/Uniswap");
    expect(normalizeLink("x", "https://x.com.evil.io/a")).toBeNull();
    expect(normalizeLink("ens", "Uniswap.ETH")).toBe("uniswap.eth");
    expect(normalizeLink("ens", "javascript:alert(1)")).toBeNull();
  });
});

describe("x handles", () => {
  it("reads accounts and skips app pages", () => {
    expect(xHandleFromPath("/Uniswap/media")).toBe("uniswap");
    expect(xHandleFromPath("/home")).toBeNull();
    expect(xHandleFromPath("/")).toBeNull();
    expect(xHandleFromUrl("https://twitter.com/Alice")).toBe("alice");
    expect(xHandleFromUrl("https://x.com.evil.io/alice")).toBeNull();
  });
});
