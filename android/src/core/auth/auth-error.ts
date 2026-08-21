/** Supabase auth failures are classified by stable provider codes only. */
export function isInvalidCredentials(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "invalid_credentials"
  );
}

export const AUTH_ISSUE_CODES = { ACCOUNT_EXISTS: "account_exists" } as const;

/** App-owned auth outcomes carry stable codes, never presentation copy. */
export class AuthIssueError extends Error {
  constructor(
    readonly code: (typeof AUTH_ISSUE_CODES)[keyof typeof AUTH_ISSUE_CODES],
  ) {
    super(code);
    this.name = "AuthIssueError";
  }
}
