import {
  formatRecoveryKey,
  hasInvalidRecoveryKeyCharacters,
  isCompleteRecoveryKey,
  RECOVERY_KEY_LENGTH,
  stripRecoveryKey,
} from "./recovery-key";

const COMPLETE_KEY = "A".repeat(RECOVERY_KEY_LENGTH);

describe("formatRecoveryKey", () => {
  it("should group by four", () => {
    expect(formatRecoveryKey("ABCDEFGH")).toBe("ABCD-EFGH");
  });

  it("should survive a paste that already carries dashes", () => {
    expect(formatRecoveryKey("abcd-efgh")).toBe("ABCD-EFGH");
  });

  it("should drop the characters the alphabet excludes", () => {
    expect(formatRecoveryKey("AB0C D1EF")).toBe("ABCD-EF");
  });

  it("should leave a partial group alone", () => {
    expect(formatRecoveryKey("ABCDE")).toBe("ABCD-E");
  });
});

describe("stripRecoveryKey", () => {
  it("should keep only base32 characters", () => {
    expect(stripRecoveryKey("a-b 2z/7!")).toBe("AB2Z7");
  });
});

describe("isCompleteRecoveryKey", () => {
  it("should accept a full key however it was typed", () => {
    expect(isCompleteRecoveryKey(formatRecoveryKey(COMPLETE_KEY))).toBe(true);
  });

  it("should reject a key one character short", () => {
    expect(isCompleteRecoveryKey(COMPLETE_KEY.slice(1))).toBe(false);
  });
});

describe("hasInvalidRecoveryKeyCharacters", () => {
  it("should accept separators", () => {
    expect(hasInvalidRecoveryKeyCharacters("ABCD-EFGH IJKL")).toBe(false);
  });

  it("should flag digits the alphabet excludes", () => {
    expect(hasInvalidRecoveryKeyCharacters("ABC0")).toBe(true);
  });
});
