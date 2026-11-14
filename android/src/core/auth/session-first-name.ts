import type { User } from "@supabase/supabase-js";

/**
 * The first name the account carries before the vault is open, when the profile
 * endpoint is still out of reach: the e-mail signup stores it as `firstName`,
 * Google as `given_name` or `full_name`.
 */
export function sessionFirstName(user: User | null): string | null {
  const metadata = user?.user_metadata;
  for (const candidate of [
    metadata?.firstName,
    metadata?.given_name,
    metadata?.full_name,
  ]) {
    if (typeof candidate !== "string") continue;
    const firstName = candidate.trim().split(/\s+/)[0];
    if (firstName) return firstName;
  }
  return null;
}
