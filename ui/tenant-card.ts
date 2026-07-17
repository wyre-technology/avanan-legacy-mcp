/**
 * Iframe bridge + renderer for the Avanan tenant card (MCP Apps, SEP-1865).
 *
 * Runs inside the host's sandboxed iframe. Uses the official MCP Apps client
 * (`App`) to receive the avanan_get_tenant tool result from the host.
 *
 * The server attaches a normalized `_card` payload to avanan_get_tenant
 * results (see src/card.builder.ts) so this renderer never needs to resolve
 * status codes or package IDs itself. The card is read-only: the MSP SmartAPI
 * has no safe, non-destructive per-tenant write suitable for an in-card
 * action (tenant writes are create/delete).
 *
 * Rendering uses DOM construction (no innerHTML) — tenant domains, package
 * names, and add-on names are untrusted vendor data, so text only ever lands
 * in text nodes.
 *
 * Branding: the card is neutral by default (this is a published server) and
 * applies an injected `window.__BRAND__` override — set by the server from
 * MCP_BRAND_* env vars at serve time, or by a gateway per-org — so the same
 * card can render in any operator's brand.
 */
import { App } from "@modelcontextprotocol/ext-apps";

interface Brand {
  name?: string;
  logoUrl?: string;
  primaryColor?: string;
  accentColor?: string;
  bg?: string;
  text?: string;
}
declare global {
  interface Window {
    __BRAND__?: Brand;
  }
}

/** Mirror of TenantCard in src/card.builder.ts — keep in sync. */
interface TenantCard {
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

const brand: Brand = window.__BRAND__ ?? {};
// No brand injected → no brand identity rendered (neutral default).
const brandName = brand.name ?? "";

// Apply any injected brand overrides onto the CSS custom properties.
function applyBrand(): void {
  const root = document.documentElement.style;
  if (brand.primaryColor) root.setProperty("--brand-primary", brand.primaryColor);
  if (brand.accentColor) root.setProperty("--brand-accent", brand.accentColor);
  if (brand.bg) root.setProperty("--brand-bg", brand.bg);
  if (brand.text) root.setProperty("--brand-text", brand.text);
}

const app = new App({ name: "Avanan Tenant Card", version: "1.0.0" });

/** Create an element with a class and (safe, text-node) children. */
function el(
  tag: string,
  className = "",
  ...children: Array<Node | string | null>
): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  for (const child of children) {
    if (child == null) continue;
    node.append(child); // strings become text nodes — never parsed as HTML
  }
  return node;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function field(label: string, value: string | undefined): HTMLElement | null {
  if (!value) return null;
  return el(
    "div",
    "field",
    el("div", "field__label", label),
    el("div", "field__value", value)
  );
}

function badge(text: string | undefined, cls: string): HTMLElement | null {
  return text ? el("span", `badge ${cls}`, text) : null;
}

function render(t: TenantCard): void {
  // Empty when no brand is injected — the span still occupies the flex slot
  // so the tenant ID stays right-aligned.
  const brandId = el("span", "brandid");
  if (brand.logoUrl) {
    const logo = document.createElement("img");
    logo.src = brand.logoUrl;
    logo.alt = brandName || "logo";
    logo.style.display = "inline-block";
    brandId.append(logo);
  }
  if (brandName) brandId.append(el("span", "brand", brandName));

  const users =
    t.users != null
      ? t.maxLicensedUsers != null
        ? `${t.users} / ${t.maxLicensedUsers}`
        : String(t.users)
      : undefined;

  const body = el(
    "div",
    "card__body",
    el("div", "brandrow", brandId, el("span", "tenantno", `Tenant #${t.id} · Avanan MSP`)),
    el("h1", "", t.domain),
    el(
      "div",
      "badges",
      badge(t.status, "badge--status"),
      badge(t.deploymentMode, "badge--mode")
    ),
    el(
      "div",
      "grid",
      field("License package", t.licensePackage),
      field("Protected users", users),
      field("PoC start", t.pocDateStart && fmtDate(t.pocDateStart)),
      field("PoC expires", t.pocDateExpiration && fmtDate(t.pocDateExpiration))
    )
  );

  if (t.addons.length > 0) {
    const addons = el("div", "addons", el("div", "addons__h", `Add-ons (${t.addons.length})`));
    for (const name of t.addons) addons.append(el("div", "addon", name));
    body.append(addons);
  }

  const root = document.getElementById("root")!;
  root.replaceChildren(el("div", "card", el("div", "card__bar"), body));
}

// avanan_get_tenant results are "Tenant:\n\n{json}" — the JSON payload carries
// the normalized card as _card (see src/card.builder.ts).
function extractCard(text: string): TenantCard | null {
  const start = text.indexOf("{");
  if (start < 0) return null;
  try {
    const payload = JSON.parse(text.slice(start)) as { _card?: TenantCard };
    const card = payload?._card;
    return card && typeof card.id === "number" && typeof card.domain === "string"
      ? card
      : null;
  } catch {
    return null; // malformed payload — render nothing
  }
}

applyBrand();

// Must be set before connect() so the initial tool-result isn't missed.
app.ontoolresult = (result: { content?: Array<{ type: string; text?: string }> }) => {
  const payload = (result.content ?? []).find((c) => c.type === "text");
  if (!payload?.text) return;
  const card = extractCard(payload.text);
  if (card) render(card);
};

app.connect();
