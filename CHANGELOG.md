# Changelog

All notable changes to this project are documented in this file. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
