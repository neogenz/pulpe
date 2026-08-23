import { uint8ArrayToHex } from "./client-key-format";
import { deriveClientKey } from "./pbkdf2";

/**
 * `react-native-quick-crypto` is a native module and cannot load under Jest, so
 * the primitive is served here by `crypto.subtle.deriveBits` — the very call
 * the webapp makes in `core/encryption/crypto.utils.ts`. That makes this suite
 * a genuine cross-client check rather than a comparison against a constant:
 * what it guards is the plumbing around the primitive (hex-decoding the salt,
 * key length in bytes rather than bits, the digest name), which is where a
 * divergence from the web would come from. The native binding itself is
 * exercised on device.
 */
jest.mock("react-native-quick-crypto", () => ({
  pbkdf2: (
    password: Uint8Array<ArrayBuffer>,
    salt: Uint8Array<ArrayBuffer>,
    iterations: number,
    keylen: number,
    digest: string,
    callback: (error: Error | null, derivedKey?: Uint8Array) => void,
  ) => {
    void crypto.subtle
      .importKey("raw", password, "PBKDF2", false, ["deriveBits"])
      .then((keyMaterial) =>
        crypto.subtle.deriveBits(
          {
            name: "PBKDF2",
            salt,
            iterations,
            hash: digest.replace("sha", "SHA-"),
          },
          keyMaterial,
          keylen * 8,
        ),
      )
      .then((bits) => callback(null, new Uint8Array(bits)))
      .catch((error: Error) => callback(error));
  },
}));

/**
 * Cross-checked against the webapp's `deriveClientKey`: same PIN, same salt and
 * same iteration count must produce the same key on both clients, or an amount
 * written on one is unreadable on the other.
 */
const SALT = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";

const WEB_VECTORS = [
  {
    pin: "1234",
    iterations: 100_000,
    expected:
      "04b547b25c6ad69f720443670ab3f4c60a33072bda08599d2ce0d1518264a679",
  },
  {
    pin: "0000",
    iterations: 600_000,
    expected:
      "c96738534dbbc4980d5f716b2e6ec70f069cd3abf3de361abb46949eeee92f32",
  },
  {
    pin: "9876",
    iterations: 100_000,
    expected:
      "3ac2a9c66f5ecda1fa3723a55c152d894bb77492080ecbc6dd28c3fa1b7a863c",
  },
] as const;

describe("deriveClientKey", () => {
  it.each(WEB_VECTORS)(
    "should match the webapp key for PIN $pin at $iterations iterations",
    async ({ pin, iterations, expected }) => {
      await expect(deriveClientKey(pin, SALT, iterations)).resolves.toBe(
        expected,
      );
    },
  );

  it("should derive a different key for a different salt", async () => {
    const otherSalt = SALT.replace(/^a1/, "b2");

    const [first, second] = await Promise.all([
      deriveClientKey("1234", SALT, 100_000),
      deriveClientKey("1234", otherSalt, 100_000),
    ]);

    expect(first).not.toBe(second);
  });

  it("should decode the salt from hex rather than hashing its characters", async () => {
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode("1234"),
      "PBKDF2",
      false,
      ["deriveBits"],
    );
    const saltAsCharacters = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: new TextEncoder().encode(SALT),
        iterations: 100_000,
        hash: "SHA-256",
      },
      keyMaterial,
      256,
    );

    await expect(deriveClientKey("1234", SALT, 100_000)).resolves.not.toBe(
      uint8ArrayToHex(new Uint8Array(saltAsCharacters)),
    );
  });
});
