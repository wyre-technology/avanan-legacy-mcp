/**
 * Shared types for the Avanan MSP SmartAPI MCP server.
 * Reference: Avanan MSP SmartAPI Reference Guide (Jan 2024).
 */

export type CallToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

/**
 * Credentials for the Avanan MSP SmartAPI.
 *
 * - appId: x-av-app-id header value (provided by Avanan Support).
 * - token: x-av-token header value (bearer-style token from the Avanan auth handshake).
 * - secret: shared secret used to compute the x-av-sig HMAC signature.
 * - region: us | eu | ca | ap. Determines the regional URL base.
 */
export interface AvananCredentials {
  appId: string;
  token: string;
  secret: string;
  region?: AvananRegion;
}

export type AvananRegion = "us" | "eu" | "ca" | "ap";

/**
 * Regional URL bases per the Avanan MSP SmartAPI guide (page 5).
 * All API calls go to https://{base}/v1.0/...
 */
export const REGIONAL_BASE_URLS: Record<AvananRegion, string> = {
  us: "https://smart-api-production-1-us.avanan.net",
  eu: "https://smart-api-production-1-eu.avanan.net",
  ca: "https://smart-api-production-1-ca.avanan.net",
  ap: "https://smart-api-production-5-ap.avanan.net",
};

export const DEFAULT_REGION: AvananRegion = "us";

/**
 * Standard Avanan response envelope (camelCase).
 * Note: `responseCode` is sometimes the SmartAPI internal code (0=success)
 * and sometimes mirrors HTTP status (200, 204). Treat HTTP status as truth.
 */
export interface ResponseEnvelope {
  requestId: string;
  responseCode: number;
  responseText: string;
  additionalText?: string;
  recordsNumber?: number;
  totalRecordsNumber?: number;
  scrollId?: string;
}

/**
 * Avanan responses wrap data in `responseData`. Depending on the endpoint,
 * this can be an array (list endpoints) or a single object (get/create/update).
 */
export interface ApiResponse<T = unknown> {
  responseEnvelope: ResponseEnvelope;
  responseData?: T;
}
