import { isInvalidCredentials } from "./auth-error";

describe("isInvalidCredentials", () => {
  it("uses the stable provider code, never the message", () => {
    expect(isInvalidCredentials({ code: "invalid_credentials" })).toBe(true);
    expect(isInvalidCredentials({ code: "other" })).toBe(false);
    expect(isInvalidCredentials(new Error("invalid login credentials"))).toBe(
      false,
    );
  });
});
