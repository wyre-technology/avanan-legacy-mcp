/**
 * Child MSP partner management.
 * Endpoints under /v1.0/msp/msp-partners.
 */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { apiRequest } from "../utils/client.js";
import { formatPagedResult, formatObjectResult, formatDeleteResult } from "../utils/format.js";
import type { CallToolResult } from "../utils/types.js";

interface MspPartner {
  id: number;
  name: string;
}

export const partnerTools: Tool[] = [
  {
    name: "avanan_list_msp_partners",
    description: "List all associated child MSP partners under the current MSP. Returns id and name for each child MSP.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "avanan_create_msp_partner",
    description: "Create a new child MSP partner under the current MSP.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Name of the new MSP partner." },
      },
      required: ["name"],
      additionalProperties: false,
    },
  },
  {
    name: "avanan_delete_msp_partner",
    description: "Delete a child MSP partner by ID. WARNING: all tenants associated with this MSP are also deleted.",
    inputSchema: {
      type: "object",
      properties: {
        msp_id: { type: "integer", description: "ID of the MSP partner to delete." },
      },
      required: ["msp_id"],
      additionalProperties: false,
    },
  },
];

export async function handlePartnerTool(
  name: string,
  args: Record<string, unknown>
): Promise<CallToolResult> {
  switch (name) {
    case "avanan_list_msp_partners": {
      const res = await apiRequest<MspPartner[]>("/msp/msp-partners");
      return formatPagedResult(res, res.responseData ?? [], "MSP partner");
    }
    case "avanan_create_msp_partner": {
      const res = await apiRequest<MspPartner>("/msp/msp-partners", {
        method: "POST",
        body: { requestData: { name: String(args.name) } },
      });
      return formatObjectResult(res, "Created MSP partner");
    }
    case "avanan_delete_msp_partner": {
      await apiRequest(`/msp/msp-partners/${Number(args.msp_id)}`, { method: "DELETE" });
      return formatDeleteResult(`MSP partner ${args.msp_id}`);
    }
    default:
      return { content: [{ type: "text", text: `Unknown partner tool: ${name}` }], isError: true };
  }
}
