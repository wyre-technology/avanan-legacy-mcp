/**
 * Per-request credential isolation via AsyncLocalStorage.
 *
 * In gateway (HTTP) mode each inbound request carries its own credential
 * headers. Instead of mutating process.env (shared across all concurrent
 * requests), credentials live in AsyncLocalStorage so each handler sees
 * only its own values.
 */

import { AsyncLocalStorage } from "node:async_hooks";
import type { AvananRegion } from "./types.js";

export interface RequestCredentials {
  appId: string;
  token: string;
  secret: string;
  region?: AvananRegion;
}

export const credentialStore = new AsyncLocalStorage<RequestCredentials>();

export function getRequestCredentials(): RequestCredentials | undefined {
  return credentialStore.getStore();
}
