/**
 * Avanan MSP SmartAPI HTTP client.
 *
 * Auth model (per the MSP SmartAPI Reference Guide, page 7):
 *   Every request carries five headers:
 *     - x-av-req-id : fresh UUID per request
 *     - x-av-token  : token from the Avanan auth handshake
 *     - x-av-app-id : Application ID provided by Avanan Support
 *     - x-av-date   : ISO-8601 UTC datetime, format 'YYYY-MM-DDTHH:mm:ss.SSSZ'
 *     - x-av-sig    : HMAC signature of the canonical request, see signRequest()
 *
 * Region selection:
 *   1. Per-request RequestCredentials.region (gateway HTTP mode).
 *   2. AVANAN_REGION env var (us | eu | ca | ap).
 *   3. JWT region claim if x-av-token is a JWT (best-effort).
 *   4. Default: "us".
 */

import { randomUUID, createHmac } from "node:crypto";
import { logger } from "./logger.js";
import { getRequestCredentials } from "./credential-store.js";
import {
  REGIONAL_BASE_URLS,
  DEFAULT_REGION,
  type AvananCredentials,
  type AvananRegion,
  type ApiResponse,
} from "./types.js";

/* -------------------------------------------------------------------------- */
/* Credentials                                                                 */
/* -------------------------------------------------------------------------- */

export function getCredentials(): AvananCredentials | null {
  const req = getRequestCredentials();
  if (req) {
    return {
      appId: req.appId,
      token: req.token,
      secret: req.secret,
      region: req.region ?? resolveRegionFromEnv(),
    };
  }

  const appId = process.env.AVANAN_APP_ID;
  const token = process.env.AVANAN_TOKEN;
  const secret = process.env.AVANAN_SECRET;

  if (!appId || !token || !secret) {
    logger.warn("Missing Avanan credentials", {
      hasAppId: !!appId,
      hasToken: !!token,
      hasSecret: !!secret,
    });
    return null;
  }

  return { appId, token, secret, region: resolveRegionFromEnv() };
}

function resolveRegionFromEnv(): AvananRegion | undefined {
  const r = process.env.AVANAN_REGION?.toLowerCase();
  if (r && r in REGIONAL_BASE_URLS) return r as AvananRegion;
  return undefined;
}

function decodeJwtRegion(token: string): AvananRegion | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = Buffer.from(parts[1], "base64url").toString("utf8");
    const claims = JSON.parse(payload) as Record<string, unknown>;
    const region = typeof claims.region === "string" ? claims.region.toLowerCase() : null;
    if (region && region in REGIONAL_BASE_URLS) return region as AvananRegion;
    return null;
  } catch {
    return null;
  }
}

function resolveBaseUrl(creds: AvananCredentials): string {
  const region =
    creds.region ?? decodeJwtRegion(creds.token) ?? DEFAULT_REGION;
  return REGIONAL_BASE_URLS[region];
}

/* -------------------------------------------------------------------------- */
/* Request signing                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Compute the x-av-sig header value.
 *
 * ─────────────────────────────────────────────────────────────────────────
 *  ★ CONTRIBUTION POINT — Signing algorithm
 * ─────────────────────────────────────────────────────────────────────────
 *  The Avanan MSP SmartAPI Reference Guide says only "Calculated signature"
 *  for x-av-sig and points to the parent "Avanan API Reference Guide" for
 *  the algorithm. That document is not in the MSP guide we have here.
 *
 *  The default below is a *best-guess*: HMAC-SHA256 over a canonical string
 *  built from method, path, x-av-date, and x-av-req-id, keyed by the shared
 *  secret, hex-encoded. This matches the common Avanan/Check Point pattern.
 *
 *  Replace the body of this function with the exact algorithm from the
 *  parent Avanan API guide. Likely shape:
 *
 *    const canonical = [method, path, date, reqId, bodyHash].join("\n");
 *    return createHmac("sha256", secret).update(canonical).digest("hex");
 *
 *  Tell us in the parent guide whether the canonical string includes:
 *    - the SHA-256 hex of the request body
 *    - the x-av-app-id value
 *    - a trailing newline
 *  …and whether the output is hex or base64.
 * ─────────────────────────────────────────────────────────────────────────
 */
export function signRequest(args: {
  method: string;
  path: string;
  date: string;
  reqId: string;
  appId: string;
  body: string;
  secret: string;
}): string {
  const bodyHash = args.body
    ? createHmac("sha256", args.secret).update(args.body).digest("hex")
    : "";

  const canonical = [
    args.method.toUpperCase(),
    args.path,
    args.date,
    args.reqId,
    args.appId,
    bodyHash,
  ].join("\n");

  return createHmac("sha256", args.secret).update(canonical).digest("hex");
}

/* -------------------------------------------------------------------------- */
/* Request                                                                     */
/* -------------------------------------------------------------------------- */

export interface ApiRequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined>;
}

export async function apiRequest<T = unknown>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<ApiResponse<T>> {
  const creds = getCredentials();
  if (!creds) {
    throw new Error(
      "No Avanan credentials configured. Set AVANAN_APP_ID, AVANAN_TOKEN, and AVANAN_SECRET."
    );
  }

  const baseUrl = resolveBaseUrl(creds);
  const method = options.method ?? "GET";
  const fullPath = path.startsWith("/") ? `/v1.0${path}` : `/v1.0/${path}`;

  const url = new URL(`${baseUrl}${fullPath}`);
  if (options.params) {
    for (const [k, v] of Object.entries(options.params)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }

  const reqId = randomUUID();
  const date = new Date().toISOString();
  const bodyText =
    options.body !== undefined && method !== "GET"
      ? JSON.stringify(options.body)
      : "";

  const sig = signRequest({
    method,
    path: url.pathname + (url.search || ""),
    date,
    reqId,
    appId: creds.appId,
    body: bodyText,
    secret: creds.secret,
  });

  const headers: Record<string, string> = {
    Accept: "application/json",
    "x-av-req-id": reqId,
    "x-av-token": creds.token,
    "x-av-app-id": creds.appId,
    "x-av-date": date,
    "x-av-sig": sig,
  };
  if (bodyText) headers["Content-Type"] = "application/json";

  const init: RequestInit = {
    method,
    headers,
    signal: AbortSignal.timeout(30_000),
  };
  if (bodyText) init.body = bodyText;

  logger.debug("Avanan API request", { method, url: url.toString() });
  const res = await fetch(url.toString(), init);

  // 204 No Content (deletes)
  if (res.status === 204) {
    return {
      responseEnvelope: {
        requestId: reqId,
        responseCode: 204,
        responseText: "Success",
      },
    };
  }

  const raw = await res.text();
  let parsed: unknown;
  try {
    parsed = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(
      `Avanan API returned non-JSON (${res.status}): ${raw.slice(0, 200)}`
    );
  }

  if (!res.ok) {
    const env = (parsed as ApiResponse).responseEnvelope;
    const msg = env?.responseText || env?.additionalText || `HTTP ${res.status}`;
    logger.error("Avanan API error", { status: res.status, url: url.toString(), msg });
    throw new Error(`Avanan API error (${res.status}): ${msg}`);
  }

  return parsed as ApiResponse<T>;
}
