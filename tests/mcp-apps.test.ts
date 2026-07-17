// MCP Apps (SEP-1865) contract tests — mirrors the checks an MCP Apps host
// performs to render the tenant card:
//   1. the renderable tool advertises the UI resource via _meta (both forms)
//   2. the ui:// resource lists and reads back as profile=mcp-app HTML
//   3. buildTenantCard normalizes a SmartAPI tenant into the card payload
//      the iframe renders from, best-effort (bad input → no card)
//   4. the default bundle is brand-neutral; brand injection is serve-time only

import { afterEach, describe, expect, it, vi } from "vitest";
import { partnerTools } from "../src/tools/partners.js";
import { userTools } from "../src/tools/users.js";
import { tenantTools, handleTenantTool } from "../src/tools/tenants.js";
import { licenseTools } from "../src/tools/licenses.js";
import { usageTools } from "../src/tools/usage.js";
import { listResources, readResource } from "../src/resources.js";
import {
  buildTenantCard,
  applyBrandInjection,
  resolveBrandFromEnv,
  TENANT_CARD_RESOURCE_URI,
  MCP_APP_RESOURCE_MIME,
} from "../src/card.builder.js";
import { TENANT_CARD_HTML } from "../src/generated/tenant-card-html.js";
import { apiRequest } from "../src/utils/client.js";

vi.mock("../src/utils/client.js", () => ({ apiRequest: vi.fn() }));

const ALL_TOOLS = [...partnerTools, ...userTools, ...tenantTools, ...licenseTools, ...usageTools];
const RENDERABLE_TOOLS = ["avanan_get_tenant"];

const sampleTenant = {
  id: 4711,
  domain: "acme.example.com",
  deploymentMode: "protect",
  pocDateStart: "2026-06-01",
  pocDateExpiration: "2026-08-30",
  users: 42,
  status: { statusCode: "active", description: "Active" },
  package: { id: 3, codeName: "cpx", displayName: "Complete Protect" },
  addons: [
    { id: 1, name: "DLP" },
    { id: 2, name: "Archiving" },
  ],
  maxLicensedUsers: 100,
};

describe("MCP Apps tenant card", () => {
  describe("tool _meta advertisement", () => {
    it.each(RENDERABLE_TOOLS)("%s links the card via _meta", (name) => {
      const tool = ALL_TOOLS.find((t) => t.name === name);
      expect(tool).toBeDefined();
      // Canonical flat key (ext-apps RESOURCE_URI_META_KEY) …
      expect(tool?._meta?.["ui/resourceUri"]).toBe(TENANT_CARD_RESOURCE_URI);
      // … and the nested form registerAppTool also emits.
      expect((tool?._meta?.ui as { resourceUri?: string })?.resourceUri).toBe(
        TENANT_CARD_RESOURCE_URI
      );
    });

    it("no other tools carry UI metadata", () => {
      const others = ALL_TOOLS.filter((t) => t._meta && !RENDERABLE_TOOLS.includes(t.name));
      expect(others).toEqual([]);
    });
  });

  describe("ui:// resource", () => {
    it("is listed with the MCP Apps MIME type", () => {
      const card = listResources().find((r) => r.uri === TENANT_CARD_RESOURCE_URI);
      expect(card?.mimeType).toBe(MCP_APP_RESOURCE_MIME);
    });

    it("reads back as profile=mcp-app HTML containing the card app", () => {
      const content = readResource(TENANT_CARD_RESOURCE_URI);
      expect(content.mimeType).toBe(MCP_APP_RESOURCE_MIME);
      expect(content.text).toBe(TENANT_CARD_HTML);
      expect(content.text).toContain("card__bar");
      expect(content.text).toContain("BRAND_INJECT");
      // The vite build must have inlined the bridge script — a bare <script src>
      // would be unloadable from a resources/read HTML string.
      expect(content.text).not.toContain('src="./tenant-card.ts"');
    });

    it("rejects unknown resource URIs", () => {
      expect(() => readResource("ui://avanan-legacy/nope.html")).toThrow(/Unknown resource/);
    });

    it("default bundle is brand-neutral (published server — no baked-in identity)", () => {
      expect(TENANT_CARD_HTML).not.toMatch(/WYRE/i);
      expect(TENANT_CARD_HTML).not.toContain("fonts.googleapis.com");
    });
  });

  describe("brand injection", () => {
    afterEach(() => vi.unstubAllEnvs());

    it("replaces the BRAND_INJECT marker with a window.__BRAND__ script", () => {
      const out = applyBrandInjection(TENANT_CARD_HTML, {
        name: "Acme MSP",
        primaryColor: "#123456",
      });
      expect(out).not.toContain("BRAND_INJECT");
      expect(out).toContain('window.__BRAND__={"name":"Acme MSP","primaryColor":"#123456"}');
    });

    it("serves the HTML byte-identical when no brand is configured", () => {
      expect(applyBrandInjection(TENANT_CARD_HTML, {})).toBe(TENANT_CARD_HTML);
    });

    it('escapes "<" so brand values cannot break out of the script element', () => {
      const out = applyBrandInjection(TENANT_CARD_HTML, { name: "</script><script>alert(1)" });
      expect(out).not.toContain("</script><script>alert(1)");
      expect(out).toContain("\\u003c/script>");
    });

    it("resolveBrandFromEnv maps MCP_BRAND_* vars and ignores everything else", () => {
      vi.stubEnv("MCP_BRAND_NAME", "Acme MSP");
      vi.stubEnv("MCP_BRAND_PRIMARY_COLOR", "#123456");
      vi.stubEnv("UNRELATED", "x");
      expect(resolveBrandFromEnv()).toEqual({ name: "Acme MSP", primaryColor: "#123456" });
    });

    it("resolveBrandFromEnv returns an empty brand when nothing is set", () => {
      for (const key of Object.keys(process.env)) {
        if (key.startsWith("MCP_BRAND_")) vi.stubEnv(key, "");
      }
      expect(resolveBrandFromEnv()).toEqual({});
    });
  });

  describe("buildTenantCard", () => {
    it("normalizes a SmartAPI tenant into the flat card payload", () => {
      expect(buildTenantCard(sampleTenant)).toEqual({
        id: 4711,
        domain: "acme.example.com",
        status: "Active",
        deploymentMode: "protect",
        licensePackage: "Complete Protect",
        users: 42,
        maxLicensedUsers: 100,
        pocDateStart: "2026-06-01",
        pocDateExpiration: "2026-08-30",
        addons: ["DLP", "Archiving"],
      });
    });

    it("falls back to statusCode / codeName when labels are missing", () => {
      const card = buildTenantCard({
        ...sampleTenant,
        status: { statusCode: "poc" },
        package: { id: 3, codeName: "cpx" },
      });
      expect(card?.status).toBe("poc");
      expect(card?.licensePackage).toBe("cpx");
    });

    it("returns null for payloads that are not a tenant", () => {
      expect(buildTenantCard(null)).toBeNull();
      expect(buildTenantCard("nope")).toBeNull();
      expect(buildTenantCard({ id: "4711", domain: "acme.example.com" })).toBeNull();
      expect(buildTenantCard({ id: 4711 })).toBeNull();
    });

    it("degrades gracefully on malformed nested fields (card is best-effort)", () => {
      const card = buildTenantCard({
        id: 4711,
        domain: "acme.example.com",
        status: "active", // not the documented object shape
        package: null,
        addons: [{ id: 1 }, "junk", null, { id: 2, name: "DLP" }],
        maxLicensedUsers: null,
      });
      expect(card).toEqual({ id: 4711, domain: "acme.example.com", addons: ["DLP"] });
    });
  });

  describe("avanan_get_tenant result", () => {
    const mockedApiRequest = vi.mocked(apiRequest);

    it("carries the normalized _card object alongside the unchanged payload", async () => {
      mockedApiRequest.mockResolvedValueOnce({
        responseEnvelope: { requestId: "r1", responseCode: 0, responseText: "ok" },
        responseData: sampleTenant,
      });
      const result = await handleTenantTool("avanan_get_tenant", { tenant_id: 4711 });
      const text = result.content[0].text;
      const payload = JSON.parse(text.slice(text.indexOf("{")));
      expect(payload.domain).toBe("acme.example.com");
      expect(payload._card).toMatchObject({ id: 4711, status: "Active" });
    });

    it("ships without a card when the payload is not renderable", async () => {
      mockedApiRequest.mockResolvedValueOnce({
        responseEnvelope: { requestId: "r2", responseCode: 0, responseText: "ok" },
        responseData: { unexpected: true },
      });
      const result = await handleTenantTool("avanan_get_tenant", { tenant_id: 1 });
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).not.toContain("_card");
    });
  });
});
