import { AUTH_ISSUE_CODES, AuthIssueError } from "./auth-error";
import { supabase } from "./supabase";

/**
 * Creates the account the onboarding flow needs before it can save anything.
 *
 * `firstName` goes into `user_metadata` under the same key the other clients
 * read — it is where a Google signup's `given_name` ends up too, and it is the
 * only place an e-mail signup's name would survive at all.
 *
 * Supabase answers in English and names its own internals, so nothing from
 * `error.message` reaches the screen — the one case worth telling apart is an
 * address that already has an account, which is a wrong turn rather than a
 * failure.
 */
export async function signUpWithEmail(
  email: string,
  password: string,
  firstName: string,
): Promise<void> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { firstName: firstName.trim() } },
  });
  if (error) throw error;

  // An existing address comes back as a success with an empty identity list
  // rather than an error, so that case has to be read off the payload.
  if (data.user !== null && data.user.identities?.length === 0) {
    throw new AuthIssueError(AUTH_ISSUE_CODES.ACCOUNT_EXISTS);
  }
}
