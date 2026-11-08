import { z } from "zod";
import { CHAIN_IDS, addressError, inferFamily, chainsInFamily, objectId, tagsSchema, linksSchema, type ChainId } from "@tagawallet/shared";
import { ApiError, route } from "@/lib/api";
import { getList, getOwnEntity, logActivity, track } from "@/lib/access";
import { parseCsv } from "@/lib/csv";
import { getDb } from "@/lib/db";
import { addToList, normalizedFor, upsertWallet } from "@/lib/wallets";

const MAX_ROWS = 10000;
const IMPORT_FIELDS = ["address", "chain", "label", "status", "tags", "notes"] as const;
type Field = (typeof IMPORT_FIELDS)[number];

const input = z.object({
  // Neither means the wallets land in the person's library, private, like a quick tag.
  listId: objectId.optional(),
  entityId: objectId.optional(),
  format: z.enum(["csv", "json"]),
  content: z.string().min(1).max(5_000_000),
  /** Which column in the file holds each field. Unmapped fields fall back to a column of the same name. */
  mapping: z.partialRecord(z.enum(IMPORT_FIELDS), z.string().max(200)).optional(),
  dryRun: z.boolean().optional(),
});

function rowsFrom(format: "csv" | "json", content: string): Record<string, unknown>[] {
  if (format === "csv") return parseCsv(content);
  let parsed: unknown;
  try { parsed = JSON.parse(content); } catch { throw new ApiError(422, "That file isn't valid JSON."); }
  const rows = Array.isArray(parsed) ? parsed : (parsed as { wallets?: unknown }).wallets;
  if (!Array.isArray(rows)) throw new ApiError(422, "Expected a JSON array of wallets, or an object with a wallets array.");
  return rows.filter((r): r is Record<string, unknown> => !!r && typeof r === "object");
}

const FALLBACK: Partial<Record<Field, string[]>> = { label: ["label", "displayLabel", "name"] };

function pick(row: Record<string, unknown>, field: Field, mapping: Partial<Record<Field, string>>) {
  const col = mapping[field];
  if (col) return row[col];
  for (const k of FALLBACK[field] ?? [field]) if (row[k] !== undefined) return row[k];
  return undefined;
}

export const POST = route(async ({ user, body }) => {
  const { listId, entityId, format, content, mapping = {}, dryRun } = await body(input);
  const list = listId ? (await getList(listId, user._id, "editor")).list : null;
  const entity = entityId ? await getOwnEntity(entityId, user._id) : null;
  const rows = rowsFrom(format, content);
  if (rows.length > MAX_ROWS) throw new ApiError(422, `Imports are limited to ${MAX_ROWS.toLocaleString()} rows at a time.`);
  const db = await getDb();
  const errors: { row: number; message: string }[] = [];
  const seen = new Set<string>();
  const preview: { row: number; address: string; chain: string; label: string; outcome: "new" | "existing" | "duplicate" }[] = [];
  let created = 0, existing = 0, duplicates = 0, imported = 0;
  for (const [i, row] of rows.entries()) {
    const address = String(pick(row, "address", mapping) ?? "").trim();
    const family = inferFamily(address);
    const named = String(pick(row, "chain", mapping) ?? "").trim().toLowerCase() as ChainId;
    const chain = CHAIN_IDS.includes(named) ? named : family ? chainsInFamily(family)[0]! : null;
    const problem = !address ? "Missing address" : !chain ? "Unrecognised address or chain" : addressError(address, chain);
    if (problem) { errors.push({ row: i + 1, message: problem }); continue; }
    const key = `${chain}:${normalizedFor(address, chain!)}`;
    const label = String(pick(row, "label", mapping) ?? "").slice(0, 120);
    // The same address twice in one file is imported once.
    if (seen.has(key)) {
      duplicates++;
      if (preview.length < 20) preview.push({ row: i + 1, address, chain: chain!, label, outcome: "duplicate" });
      continue;
    }
    seen.add(key);
    const prior = await db.collection("wallets").findOne({ ownerId: user._id, chain, normalizedAddress: normalizedFor(address, chain!) }, { projection: { _id: 1 } });
    const inList = prior && list ? !!(await db.collection("wallet_list_memberships").findOne({ listId: list._id, walletId: prior._id })) : false;
    const outcome = inList ? "duplicate" : prior ? "existing" : "new";
    if (preview.length < 20) preview.push({ row: i + 1, address, chain: chain!, label, outcome });
    if (outcome === "duplicate") { duplicates++; continue; }
    if (outcome === "new") created++; else existing++;
    // Nowhere to add it, and it's already yours: nothing would change.
    if (outcome === "existing" && !list && !entity) continue;
    if (dryRun) { imported++; continue; }

    const tagsRaw = pick(row, "tags", mapping);
    const rawTags = Array.isArray(tagsRaw) ? tagsRaw : String(tagsRaw ?? "").split(/[;|]/).map((t) => t.trim()).filter(Boolean);
    const tags = tagsSchema.safeParse(rawTags);
    const links = linksSchema.safeParse(row.links ?? []);
    // An address you already have keeps its name and labels. Importing only adds it where you asked.
    const { wallet } = await upsertWallet(user._id, {
      address, chain: chain!, displayLabel: label, notes: String(pick(row, "notes", mapping) ?? "").slice(0, 5000),
      tags: tags.success ? tags.data : [], status: String(pick(row, "status", mapping) ?? "none").trim().toLowerCase().slice(0, 30) || "none",
      links: links.success ? links.data : [], source: "import",
    });
    if (list) await addToList(list._id, wallet._id, user._id);
    if (entity) {
      const now = new Date();
      await db.collection("wallet_entity_links").updateOne({ walletId: wallet._id, entityId: entity._id }, {
        $setOnInsert: { relationship: "associated", visibility: "private", source: "import", claimedBy: user._id, evidence: [], createdAt: now, updatedAt: now },
      }, { upsert: true });
    }
    imported++;
  }
  if (!dryRun && imported) {
    if (list) await logActivity(list._id, user._id, "imported wallets", String(imported));
    await track("wallets_imported", user._id, { count: imported });
  }
  return { imported, created, existing, duplicates, errors: errors.slice(0, 50), errorCount: errors.length, total: rows.length, preview, dryRun: !!dryRun };
}, { rate: { name: "import", limit: 60, windowSec: 3600 } });
