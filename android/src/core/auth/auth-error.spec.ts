import {
  AUTH_ISSUE_CODES,
  AuthIssueError,
  isInvalidCredentials,
} from "./auth-error";

describe("isInvalidCredentials", () => {
  it("uses the stable provider code, never the message", () => {
    expect(isInvalidCredentials({ code: "invalid_credentials" })).toBe(true);
    expect(isInvalidCredentials({ code: "other" })).toBe(false);
    expect(isInvalidCredentials(new Error("invalid login credentials"))).toBe(
      false,
    );
  });

  it("keeps app-owned auth issues language-neutral", () => {
    const error = new AuthIssueError(AUTH_ISSUE_CODES.ACCOUNT_EXISTS);
    expect(error.code).toBe("account_exists");
    expect(error.message).toBe("account_exists");
  });
});
