# Changelog

All notable changes to this project are documented in this file. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Interactive tenant card via MCP Apps (SEP-1865).** `avanan_get_tenant` results now render as an interactive card in MCP Apps hosts (Claude Desktop/web, and other hosts advertising the `io.modelcontextprotocol/ui` extension) instead of a wall of JSON. The card shows the tenant domain, status, deployment mode, license package, protected-user counts, PoC dates, and add-ons. Non-App hosts are unaffected: the tool's JSON payload is unchanged apart from a new `_card` field.
  - The card is **brand-neutral by default** (system fonts, neutral palette, no baked-in identity — this is a published server) and brandable without rebuilding: `MCP_BRAND_NAME`, `MCP_BRAND_LOGO_URL`, `MCP_BRAND_PRIMARY_COLOR`, `MCP_BRAND_ACCENT_COLOR`, `MCP_BRAND_BG`, and `MCP_BRAND_TEXT` env vars are injected as `window.__BRAND__` at serve time (a gateway can inject the same object per-org). A test pins the default bundle to zero brand identity and zero external font fetches.
  - The renderable tool advertises the UI via `_meta` (`ui/resourceUri`, plus the nested `ui.resourceUri` form) pointing at a new `ui://avanan-legacy/tenant-card.html` resource served as `text/html;profile=mcp-app` — the server now declares the `resources` capability. The card HTML is a self-contained vite single-file bundle embedded at build time (`src/generated/tenant-card-html.ts`, committed), so plain `npm run build` and CI don't need vite.
  - The card is **read-only**: the MSP SmartAPI's only per-tenant writes are create/delete and license assignment, none of which are safe as an in-card action.
  - The card payload builder is best-effort: malformed payloads drop the card without affecting the tool result. 17 new contract tests in `tests/mcp-apps.test.ts` pin the `_meta` advertisement, the `ui://` resource wire shape, brand injection (incl. `<`-escaping and empty-brand byte-identity), and the card normalization.
  - New `npm run build:ui` regenerates the embedded HTML after editing `ui/` (requires the new `vite`, `vite-plugin-singlefile`, and `@modelcontextprotocol/ext-apps` devDependencies).

## [1.0.0] - 2026-05-21

### Added
- Initial MCP server for the Avanan MSP SmartAPI (Jan 2024 reference guide).
- 17 tools across 5 groups:
  - **Child MSPs**: `avanan_list_msp_partners`, `avanan_create_msp_partner`, `avanan_delete_msp_partner`.
  - **MSP users**: `avanan_list_msp_users`, `avanan_get_msp_user`, `avanan_create_msp_user`, `avanan_update_msp_user`, `avanan_delete_msp_user`.
  - **Customer tenants**: `avanan_list_tenants`, `avanan_get_tenant`, `avanan_create_tenant`, `avanan_delete_tenant`.
  - **Licenses**: `avanan_list_licenses`, `avanan_list_addons`, `avanan_assign_license`.
  - **Usage**: `avanan_get_monthly_usage`, `avanan_get_daily_usage`.
- Region auto-detection (env > JWT region claim > `us` default) across US, EU, CA, AP.
- Stdio (local) and HTTP (gateway) transports.
- AsyncLocalStorage credential isolation for concurrent gateway requests.

### Known issues
- The `x-av-sig` signing algorithm is a best-guess (HMAC-SHA256 over a canonical
  string of method, path, date, req-id, app-id, body-hash) because the Avanan
  MSP SmartAPI guide refers to the parent Avanan API Reference Guide for the
  exact algorithm. Replace `signRequest()` in `src/utils/client.ts` once that
  spec is in hand.
