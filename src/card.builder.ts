/**
 * Tenant-card payload builder for the MCP Apps (SEP-1865) UI surface.
 *
 * avanan_get_tenant results get a normalized `_card` object attached (see
 * tools/tenants.ts) that the ui:// tenant card renders from. The card is
 * progressive enhancement: building is best-effort, and a null return simply
 * means the host renders no card while the JSON payload is unchanged.
 *
 * The card is read-only. The MSP SmartAPI's only per-tenant writes are
 * create/delete (destructive) and license assignment — none are safe as an
 * in-card action, so no round-trip is exposed.
 */

export const TENANT_CARD_RESOURCE_URI = "ui://avanan-legacy/tenant-card.html";

/** MCP Apps resource MIME (RESOURCE_MIME_TYPE in @modelcontextprotocol/ext-apps). */
export const MCP_APP_RESOURCE_MIME = "text/html;profile=mcp-app";

/**
 * Tool `_meta` advertising the card. Carries both the canonical flat key
 * (RESOURCE_URI_META_KEY in ext-apps) and the nested form ext-apps'
 * registerAppTool emits, so any MCP Apps host revision finds it.
 */
export const TENANT_CARD_META = {
  "ui/resourceUri": TENANT_CARD_RESOURCE_URI,
  ui: { resourceUri: TENANT_CARD_RESOURCE_URI },
} as const;

/** Mirror of Brand in ui/tenant-card.ts — keep in sync. */
export interface CardBrand {
  name?: string;
  logoUrl?: string;
  primaryColor?: string;
  accentColor?: string;
  bg?: string;
  text?: string;
}

/** The BRAND_INJECT comment marker baked into the card HTML (see ui/index.html). */
const BRAND_INJECT_RE = /<!--\s*BRAND_INJECT:[\s\S]*?-->/;

/**
 * Serve-time brand injection: replace the BRAND_INJECT marker with an inline
 * `window.__BRAND__` script so self-hosters can theme the card without
 * rebuilding the bundle. An empty brand returns the HTML unchanged (the card
 * renders its neutral defaults). `<` is escaped so brand values can never
 * break out of the script tag.
 */
export function applyBrandInjection(html: string, brand: CardBrand): string {
  if (!brand || Object.values(brand).every((v) => !v)) return html;
  const json = JSON.stringify(brand).replace(/</g, "\\u003c");
  return html.replace(BRAND_INJECT_RE, `<script>window.__BRAND__=${json}</script>`);
}

/**
 * Resolve brand overrides from MCP_BRAND_* environment variables. Guarded for
 * runtimes without `process`, where this returns an empty brand and the card
 * serves its neutral defaults.
 */
export function resolveBrandFromEnv(): CardBrand {
  if (typeof process === "undefined" || !process.env) return {};
  const env = process.env;
  const brand: CardBrand = {};
  if (env.MCP_BRAND_NAME) brand.name = env.MCP_BRAND_NAME;
  if (env.MCP_BRAND_LOGO_URL) brand.logoUrl = env.MCP_BRAND_LOGO_URL;
  if (env.MCP_BRAND_PRIMARY_COLOR) brand.primaryColor = env.MCP_BRAND_PRIMARY_COLOR;
  if (env.MCP_BRAND_ACCENT_COLOR) brand.accentColor = env.MCP_BRAND_ACCENT_COLOR;
  if (env.MCP_BRAND_BG) brand.bg = env.MCP_BRAND_BG;
  if (env.MCP_BRAND_TEXT) brand.text = env.MCP_BRAND_TEXT;
  return brand;
}

/** Mirror of TenantCard in ui/tenant-card.ts — keep in sync. */
export interface TenantCard {
  id: number;
  domain: string;
  status?: string;
  deploymentMode?: string;
  licensePackage?: string;
  users?: number;
  maxLicensedUsers?: number;
  pocDateStart?: string;
  pocDateExpiration?: string;
  addons: string[];
}

/**
 * Build the renderable card from an avanan_get_tenant payload. Every label the
 * card shows is already resolved in the SmartAPI response (status.description,
 * package.displayName, addons[].name), so no extra lookups are needed — the
 * builder only flattens and validates. Never throws: malformed input returns
 * null and the tool result ships without a card.
 */
export function buildTenantCard(tenant: unknown): TenantCard | null {
  try {
    const t = tenant as Record<string, unknown>;
    if (typeof t?.id !== "number" || typeof t.domain !== "string" || !t.domain) {
      return null;
    }

    const card: TenantCard = { id: t.id, domain: t.domain, addons: [] };

    const status = t.status as { statusCode?: string; description?: string } | undefined;
    if (status && typeof status === "object") {
      const label = status.description || status.statusCode;
      if (typeof label === "string" && label) card.status = label;
    }

    if (typeof t.deploymentMode === "string" && t.deploymentMode) {
      card.deploymentMode = t.deploymentMode;
    }

    const pkg = t.package as { displayName?: string; codeName?: string } | null | undefined;
    if (pkg && typeof pkg === "object") {
      const label = pkg.displayName || pkg.codeName;
      if (typeof label === "string" && label) card.licensePackage = label;
    }

    if (typeof t.users === "number") card.users = t.users;
    if (typeof t.maxLicensedUsers === "number") card.maxLicensedUsers = t.maxLicensedUsers;
    if (typeof t.pocDateStart === "string" && t.pocDateStart) card.pocDateStart = t.pocDateStart;
    if (typeof t.pocDateExpiration === "string" && t.pocDateExpiration) {
      card.pocDateExpiration = t.pocDateExpiration;
    }

    if (Array.isArray(t.addons)) {
      card.addons = t.addons
        .map((a) => (a && typeof a === "object" ? (a as { name?: unknown }).name : undefined))
        .filter((n): n is string => typeof n === "string" && n.length > 0);
    }

    return card;
  } catch {
    return null; // best-effort: no card, tool result unchanged
  }
}
