import {
  hexToUint8Array,
  isValidClientKeyHex,
  uint8ArrayToHex,
} from "./client-key-format";

const VALID_KEY =
  "04b547b25c6ad69f720443670ab3f4c60a33072bda08599d2ce0d1518264a679";

describe("hex conversion", () => {
  it("should round-trip a byte sequence", () => {
    const bytes = new Uint8Array([0x00, 0x0f, 0x7f, 0x80, 0xff]);

    expect(hexToUint8Array(uint8ArrayToHex(bytes))).toEqual(bytes);
  });

  it("should pad a single-digit byte to two hex characters", () => {
    expect(uint8ArrayToHex(new Uint8Array([0x05]))).toBe("05");
  });
});

describe("isValidClientKeyHex", () => {
  it("should accept a 64-character hex key", () => {
    expect(isValidClientKeyHex(VALID_KEY)).toBe(true);
  });

  it("should reject the all-zero key", () => {
    expect(isValidClientKeyHex("0".repeat(64))).toBe(false);
  });

  it("should reject a key of the wrong length", () => {
    expect(isValidClientKeyHex("ab".repeat(30))).toBe(false);
  });

  it("should reject a key holding a non-hex character", () => {
    expect(isValidClientKeyHex(`${"a".repeat(63)}z`)).toBe(false);
  });
});
