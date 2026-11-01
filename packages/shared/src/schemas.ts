import { z } from "zod";
import { CHAIN_IDS } from "./chains";
import { addressError } from "./address";
import { LINK_TYPES, normalizeLink } from "./urls";

const cleanText = (max: number) => z.string().trim().max(max);
export const objectId = z.string().regex(/^[a-f0-9]{24}$/, "Invalid id");

export const WALLET_STATUSES = ["none", "mine", "watchlist", "scam", "trusted"] as const;
export const ENTITY_TYPES = ["individual", "project", "dao", "exchange", "protocol", "company", "other"] as const;
export const LINK_STATUSES = ["official", "personal", "community", "source"] as const;
export const RELATIONSHIPS = ["owner", "treasury", "hot_wallet", "cold_wallet", "associated", "custom"] as const;
export const ROLES = ["viewer", "editor", "admin"] as const;
export const REPORT_REASONS = ["incorrect", "impersonation", "doxxing", "spam", "malicious_link", "stolen_profile", "other"] as const;
export const VERIFY_METHODS = ["x_post", "dns", "meta", "ens", "signature"] as const;

export const emailSchema = z.string().trim().toLowerCase().email().max(254);
export const passwordSchema = z.string().min(10, "Use at least 10 characters").max(200);

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: cleanText(80).min(1, "Add a name"),
});
export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(200) });

export const tagsSchema = z.array(cleanText(40).min(1).transform((t) => t.toLowerCase())).max(30)
  .transform((t) => [...new Set(t)]);

export const linkSchema = z.object({
  type: z.enum(LINK_TYPES),
  url: z.string().trim().min(1).max(2048),
  label: cleanText(80).optional().default(""),
  status: z.enum(LINK_STATUSES).optional().default("source"),
}).transform((link, ctx) => {
  const url = normalizeLink(link.type, link.url);
  if (!url) {
    ctx.addIssue({ code: "custom", message: `That isn't a valid ${link.type} link.`, path: ["url"] });
    return z.NEVER;
  }
  return { ...link, url };
});
export const linksSchema = z.array(linkSchema).max(30);

export const listCreateSchema = z.object({
  name: cleanText(80).min(1, "Name your list"),
  description: cleanText(500).optional().default(""),
  tags: tagsSchema.optional().default([]),
});
export const listUpdateSchema = z.object({
  name: cleanText(80).min(1).optional(),
  description: cleanText(500).optional(),
  tags: tagsSchema.optional(),
  archived: z.boolean().optional(),
  // Public lists would publish attribution with no verification, so v1 stops at shared.
  visibility: z.enum(["private", "shared"]).optional(),
});
export const inviteSchema = z.object({
  email: emailSchema.optional(),
  role: z.enum(ROLES).default("viewer"),
});

export const walletCreateSchema = z.object({
  address: z.string().trim().min(1, "Paste an address").max(120),
  chain: z.enum(CHAIN_IDS),
  displayLabel: cleanText(120).optional().default(""),
  notes: cleanText(5000).optional().default(""),
  tags: tagsSchema.optional().default([]),
  status: z.string().trim().max(30).optional().default("none"),
  links: linksSchema.optional().default([]),
  listId: objectId.optional(),
  entityId: objectId.optional(),
  source: z.enum(["user", "import", "extension"]).optional().default("user"),
}).superRefine((w, ctx) => {
  const message = addressError(w.address, w.chain);
  if (message) ctx.addIssue({ code: "custom", path: ["address"], message });
});
export const walletUpdateSchema = z.object({
  displayLabel: cleanText(120).optional(),
  notes: cleanText(5000).optional(),
  tags: tagsSchema.optional(),
  status: z.string().trim().max(30).optional(),
  links: linksSchema.optional(),
});

export const entityCreateSchema = z.object({
  name: cleanText(120).min(1, "Name the entity"),
  type: z.enum(ENTITY_TYPES).default("other"),
  description: cleanText(2000).optional().default(""),
  avatarUrl: z.string().trim().max(2048).optional().default(""),
  links: linksSchema.optional().default([]),
  tags: tagsSchema.optional().default([]),
});
export const entityUpdateSchema = entityCreateSchema.partial();
export const entityLinkSchema = z.object({
  walletId: objectId,
  relationship: z.enum(RELATIONSHIPS).default("associated"),
  visibility: z.enum(["private", "shared", "public"]).default("private"),
});

export const reportSchema = z.object({
  targetType: z.enum(["wallet", "entity", "link", "wallet_entity_link"]).default("entity"),
  targetId: objectId,
  reason: z.enum(REPORT_REASONS),
  details: cleanText(2000).optional().default(""),
});

export const resolveSchema = z.object({
  addresses: z.array(z.object({
    normalized: z.string().trim().min(1).max(120),
    kind: z.enum(["evm", "solana", "bitcoin", "ens", "sns"]),
  })).max(200),
});

export const extensionTagSchema = z.object({
  address: z.string().trim().min(1).max(120),
  chain: z.enum(CHAIN_IDS),
  displayLabel: cleanText(120).min(1, "Add a name"),
  notes: cleanText(5000).optional().default(""),
  tags: tagsSchema.optional().default([]),
  status: z.string().trim().max(30).optional().default("none"),
  links: linksSchema.optional().default([]),
  listId: objectId.optional(),
  newListName: cleanText(80).optional(),
  entityId: objectId.optional(),
  newEntityName: cleanText(120).optional(),
}).superRefine((w, ctx) => {
  const message = addressError(w.address, w.chain);
  if (message) ctx.addIssue({ code: "custom", path: ["address"], message });
});

export const extensionSettingsSchema = z.object({
  chipsEnabled: z.boolean(),
  chipStyle: z.enum(["minimal", "badge", "hidden"]),
  disabledSites: z.array(z.string().max(255)).max(1000),
  enabledSites: z.array(z.string().max(255)).max(1000),
  cloudSync: z.boolean(),
  defaultListId: objectId.nullable(),
  theme: z.enum(["system", "light", "dark"]),
}).partial();
