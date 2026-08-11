import { getAccessToken } from "@/core/auth/supabase";
import { ENV } from "@/core/config/env";

import { ApiClient } from "./api-client";

/**
 * The vault client key arrives in phase 3. Until then every request goes out
 * without it, which the backend accepts for the endpoints that carry no
 * encrypted column.
 */
function getClientKey(): string | null {
  return null;
}

export const api = new ApiClient({
  baseUrl: ENV.apiBaseUrl,
  getAccessToken,
  getClientKey,
});
