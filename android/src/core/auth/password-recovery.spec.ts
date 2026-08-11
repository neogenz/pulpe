import { parseRecoveryTokens } from "./password-recovery";
import { isAcceptablePassword } from "./password-rules";

jest.mock("./supabase", () => ({ supabase: { auth: {} } }));

const RECOVERY_LINK =
  "https://app.pulpe.app/reset-password#access_token=access-1&refresh_token=refresh-1&expires_in=3600&token_type=bearer&type=recovery";

describe("parseRecoveryTokens", () => {
  it("reads both tokens out of the fragment", () => {
    expect(parseRecoveryTokens(RECOVERY_LINK)).toEqual({
      accessToken: "access-1",
      refreshToken: "refresh-1",
    });
  });

  it("rejects an expired link, which carries an error instead of tokens", () => {
    const expired =
      "https://app.pulpe.app/reset-password#error=access_denied&error_code=otp_expired";

    expect(parseRecoveryTokens(expired)).toBeNull();
  });

  it("rejects a link with no fragment at all", () => {
    expect(parseRecoveryTokens("https://app.pulpe.app/reset-password")).toBe(
      null,
    );
  });

  // A magic-link or signup confirmation lands on the same address; only a
  // recovery link may open the change-password screen.
  it("rejects a fragment whose type is not recovery", () => {
    const magicLink = RECOVERY_LINK.replace("type=recovery", "type=magiclink");

    expect(parseRecoveryTokens(magicLink)).toBeNull();
  });

  it("rejects a fragment missing the refresh token", () => {
    const partial = RECOVERY_LINK.replace("refresh_token=refresh-1&", "");

    expect(parseRecoveryTokens(partial)).toBeNull();
  });
});

describe("isAcceptablePassword", () => {
  it.each([
    ["motdepasse1", true],
    ["Motdepasse2026", true],
    ["court1a", false],
    ["motdepasse", false],
    ["12345678", false],
  ])("scores %s as %s", (password, expected) => {
    expect(isAcceptablePassword(password)).toBe(expected);
  });
});
