/** Supabase auth failures are classified by stable provider codes only. */
export function isInvalidCredentials(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "invalid_credentials"
  );
}
