/**
 * Usage/billing reporting.
 * Endpoints: /v1.0/msp/usage (monthly), /v1.0/msp/usage/day (daily).
 */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { apiRequest } from "../utils/client.js";
import { formatPagedResult } from "../utils/format.js";
import type { CallToolResult } from "../utils/types.js";

interface UsageRow {
  day: string;
  tenantDomain: string;
  licenseCodeName: string;
  users: number;
  dailyPrice: number;
  cost: number;
}

export const usageTools: Tool[] = [
  {
    name: "avanan_get_monthly_usage",
    description: "Get monthly usage details across all customer tenants for a given year/month. Returns per-day, per-tenant rows with user count, daily price, and cost.",
    inputSchema: {
      type: "object",
      properties: {
        year: { type: "integer", description: "Year, e.g. 2024." },
        month: { type: "integer", minimum: 1, maximum: 12, description: "Month, 1-12." },
      },
      required: ["year", "month"],
      additionalProperties: false,
    },
  },
  {
    name: "avanan_get_daily_usage",
    description: "Get daily usage details across all customer tenants for a specific year/month/day.",
    inputSchema: {
      type: "object",
      properties: {
        year: { type: "integer", description: "Year, e.g. 2024." },
        month: { type: "integer", minimum: 1, maximum: 12, description: "Month, 1-12." },
        day: { type: "integer", minimum: 1, maximum: 31, description: "Day of month." },
      },
      required: ["year", "month", "day"],
      additionalProperties: false,
    },
  },
];

export async function handleUsageTool(
  name: string,
  args: Record<string, unknown>
): Promise<CallToolResult> {
  switch (name) {
    case "avanan_get_monthly_usage": {
      const res = await apiRequest<UsageRow[]>("/msp/usage", {
        params: { year: Number(args.year), month: Number(args.month) },
      });
      return formatPagedResult(res, res.responseData ?? [], "usage row");
    }
    case "avanan_get_daily_usage": {
      const res = await apiRequest<UsageRow[]>("/msp/usage/day", {
        params: {
          year: Number(args.year),
          month: Number(args.month),
          day: Number(args.day),
        },
      });
      return formatPagedResult(res, res.responseData ?? [], "usage row");
    }
    default:
      return { content: [{ type: "text", text: `Unknown usage tool: ${name}` }], isError: true };
  }
}
