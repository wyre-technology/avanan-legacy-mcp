# avanan-legacy-mcp

MCP server for the **Avanan MSP SmartAPI** (the "legacy" Avanan MSP tenant management
API — distinct from `avanan-mcp`, which targets the Checkpoint Harmony Email & Collaboration
HEC API).

Implements the Jan 2024 Avanan MSP SmartAPI Reference Guide:

| Group | Tools |
| --- | --- |
| Child MSPs | `avanan_list_msp_partners`, `avanan_create_msp_partner`, `avanan_delete_msp_partner` |
| MSP users | `avanan_list_msp_users`, `avanan_get_msp_user`, `avanan_create_msp_user`, `avanan_update_msp_user`, `avanan_delete_msp_user` |
| Customer tenants | `avanan_list_tenants`, `avanan_get_tenant`, `avanan_create_tenant`, `avanan_delete_tenant` |
| Licenses | `avanan_list_licenses`, `avanan_list_addons`, `avanan_assign_license` |
| Usage | `avanan_get_monthly_usage`, `avanan_get_daily_usage` |

## Configuration

| Env var | Required | Description |
| --- | --- | --- |
| `AVANAN_APP_ID` | yes | Application ID provided by Avanan Support (`x-av-app-id`). |
| `AVANAN_TOKEN` | yes | Token from the Avanan auth handshake (`x-av-token`). |
| `AVANAN_SECRET` | yes | Shared secret used to compute the `x-av-sig` HMAC. |
| `AVANAN_REGION` | no | `us` \| `eu` \| `ca` \| `ap`. Defaults to JWT region claim, then `us`. |
| `MCP_TRANSPORT` | no | `stdio` (default) or `http`. |
| `MCP_HTTP_PORT` | no | HTTP transport port (default 8080). |
| `LOG_LEVEL` | no | `debug` \| `info` \| `warn` \| `error` (default `info`). |

In **gateway mode**, credentials are taken per-request from headers:
`X-Avanan-App-Id`, `X-Avanan-Token`, `X-Avanan-Secret`, optionally `X-Avanan-Region`.

## Status

> [!IMPORTANT]
> The `x-av-sig` signing algorithm is implemented as a **best-guess HMAC-SHA256**
> because the MSP SmartAPI guide defers signing details to the parent Avanan API
> Reference Guide. Replace the body of `signRequest()` in
> [`src/utils/client.ts`](src/utils/client.ts) with the exact algorithm before
> production use. The function is isolated so no other code needs to change.

## Build

```bash
npm install
npm run build
npm start
```

## Regional endpoints

| Region | Base |
| --- | --- |
| US | `https://smart-api-production-1-us.avanan.net` |
| EU | `https://smart-api-production-1-eu.avanan.net` |
| CA | `https://smart-api-production-1-ca.avanan.net` |
| AP | `https://smart-api-production-5-ap.avanan.net` |

All endpoints sit under `/v1.0/msp/...`.
