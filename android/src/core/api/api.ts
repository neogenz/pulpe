import { getAccessToken } from "@/core/auth/supabase";
import { ENV } from "@/core/config/env";
import { getCachedClientKey } from "@/core/crypto/client-key-manager";

import { ApiClient } from "./api-client";

/**
 * Requests made before the vault is unlocked go out without `X-Client-Key`.
 * That is correct for the endpoints that carry no encrypted column — the vault
 * and version checks — and wrong for everything else, which is why data queries
 * stay disabled until the unlock (see `docs-android/DATA_LAYER.md`).
 */
export const api = new ApiClient({
  baseUrl: ENV.apiBaseUrl,
  getAccessToken,
  getClientKey: getCachedClientKey,
});
