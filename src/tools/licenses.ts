/**
 * License and add-on management.
 * Endpoints: /v1.0/msp/licenses, /v1.0/msp/addons, /v1.0/msp/tenants/{id}/license.
 */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { apiRequest } from "../utils/client.js";
import { formatPagedResult, formatObjectResult } from "../utils/format.js";
import type { CallToolResult } from "../utils/types.js";

interface License {
  id: number;
  codeName: string;
  displayName: string;
}

interface Addon {
  id: number;
  name: string;
}

export const licenseTools: Tool[] = [
  {
    name: "avanan_list_licenses",
    description: "List all available license packages (id, codeName, displayName). Use the codeName when assigning a license to a tenant.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "avanan_list_addons",
    description: "List all available license add-ons (id, name). Add-on IDs are used when assigning a license to a tenant.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "avanan_assign_license",
    description: "Assign a license (and optional add-ons) to an existing customer tenant.",
    inputSchema: {
      type: "object",
      properties: {
        tenant_id: { type: "integer", description: "Avanan tenant ID to assign the license to." },
        licenseCodeName: {
          type: "string",
          description: "Code name of the desired license from avanan_list_licenses (e.g. 'complete_malware').",
        },
        addonIdList: {
          type: "array",
          items: { type: "integer" },
          description: "Optional list of add-on IDs from avanan_list_addons.",
        },
        maxLicensedUsers: {
          type: "integer",
          description: "Optional maximum number of users for the tenant under this license.",
        },
      },
      required: ["tenant_id", "licenseCodeName"],
      additionalProperties: false,
    },
  },
];

export async function handleLicenseTool(
  name: string,
  args: Record<string, unknown>
): Promise<CallToolResult> {
  switch (name) {
    case "avanan_list_licenses": {
      const res = await apiRequest<License[]>("/msp/licenses");
      return formatPagedResult(res, res.responseData ?? [], "license");
    }
    case "avanan_list_addons": {
      const res = await apiRequest<Addon[]>("/msp/addons");
      return formatPagedResult(res, res.responseData ?? [], "add-on");
    }
    case "avanan_assign_license": {
      const { tenant_id, ...payload } = args;
      const res = await apiRequest(`/msp/tenants/${Number(tenant_id)}/license`, {
        method: "POST",
        body: { requestData: payload },
      });
      return formatObjectResult(res, "Assigned license");
    }
    default:
      return { content: [{ type: "text", text: `Unknown license tool: ${name}` }], isError: true };
  }
}
