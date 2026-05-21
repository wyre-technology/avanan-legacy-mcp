import type { ApiResponse, CallToolResult } from "./types.js";

/**
 * Format a paged list response as a CallToolResult.
 */
export function formatPagedResult<T>(
  result: ApiResponse<T[]>,
  summary: unknown,
  label: string
): CallToolResult {
  const data = Array.isArray(result.responseData) ? result.responseData : [];
  const count = result.responseEnvelope.recordsNumber ?? data.length;
  const total = result.responseEnvelope.totalRecordsNumber;
  const scrollId = result.responseEnvelope.scrollId;

  const lines = [
    `Found ${count}${total !== undefined && total !== count ? ` of ${total}` : ""} ${label}${count !== 1 ? "s" : ""}.`,
    ...(scrollId ? [`Next page scroll ID: ${scrollId}`] : []),
    "",
    JSON.stringify(summary, null, 2),
  ];

  return { content: [{ type: "text", text: lines.join("\n") }] };
}

/**
 * Format a single-object response (get/create/update) as a CallToolResult.
 */
export function formatObjectResult(
  result: ApiResponse<unknown>,
  label: string
): CallToolResult {
  const lines = [
    `${label}:`,
    "",
    JSON.stringify(result.responseData ?? null, null, 2),
  ];
  return { content: [{ type: "text", text: lines.join("\n") }] };
}

/**
 * Format a delete/no-content response as a CallToolResult.
 */
export function formatDeleteResult(label: string): CallToolResult {
  return { content: [{ type: "text", text: `${label} deleted.` }] };
}
