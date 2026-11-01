import { z } from "zod";
import { CHAIN_IDS, addressError, inferFamily, chainsInFamily, objectId, tagsSchema, linksSchema, type ChainId } from "@tagawallet/shared";
import { ApiError, route } from "@/lib/api";
import { getList, logActivity } from "@/lib/access";
import { parseCsv } from "@/lib/csv";
import { addToList, upsertWallet } from "@/lib/wallets";

const MAX_ROWS = 10000;

const input = z.object({
  listId: objectId,
  format: z.enum(["csv", "json"]),
  content: z.string().min(1).max(5_000_000),
  dryRun: z.boolean().optional(),
});

function rowsFrom(format: "csv" | "json", content: string): Record<string, unknown>[] {
  if (format === "csv") return parseCsv(content);
  let parsed: unknown;
  try { parsed = JSON.parse(content); } catch { throw new ApiError(422, "That file isn't valid JSON."); }
  const rows = Array.isArray(parsed) ? parsed : (parsed as { wallets?: unknown }).wallets;
  if (!Array.isArray(rows)) throw new ApiError(422, "Expected a JSON array of wallets, or an object with a wallets array.");
  return rows;
}

export const POST = route(async ({ user, body }) => {
  const { listId, format, content, dryRun } = await body(input);
  const { list } = await getList(listId, user._id, "editor");
  const rows = rowsFrom(format, content);
  if (rows.length > MAX_ROWS) throw new ApiError(422, `Imports are limited to ${MAX_ROWS.toLocaleString()} rows at a time.`);
  const errors: { row: number; message: string }[] = [];
  let imported = 0, duplicates = 0;
  for (const [i, row] of rows.entries()) {
    const address = String(row.address ?? "").trim();
    const family = inferFamily(address);
    const named = String(row.chain ?? "").toLowerCase() as ChainId;
    const chain = CHAIN_IDS.includes(named) ? named : family ? chainsInFamily(family)[0]! : null;
    const problem = !address ? "Missing address" : !chain ? "Unrecognised address or chain" : addressError(address, chain);
    if (problem) { errors.push({ row: i + 1, message: problem }); continue; }
    const rawTags = Array.isArray(row.tags) ? row.tags : String(row.tags ?? "").split(/[;|]/).map((t) => t.trim()).filter(Boolean);
    const tags = tagsSchema.safeParse(rawTags);
    const links = linksSchema.safeParse(row.links ?? []);
    if (dryRun) { imported++; continue; }
    const { wallet } = await upsertWallet(user._id, {
      address, chain: chain!, displayLabel: String(row.label ?? row.displayLabel ?? "").slice(0, 120), notes: String(row.notes ?? "").slice(0, 5000),
      tags: tags.success ? tags.data : [], status: String(row.status ?? "none").slice(0, 30), links: links.success ? links.data : [], source: "import",
    });
    if (await addToList(list._id, wallet._id, user._id)) imported++; else duplicates++;
  }
  if (!dryRun && imported) await logActivity(list._id, user._id, "imported wallets", String(imported));
  return { imported, duplicates, errors: errors.slice(0, 50), errorCount: errors.length };
}, { rate: { name: "import", limit: 20, windowSec: 3600 } });
