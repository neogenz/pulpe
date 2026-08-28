/**
 * What a client key looks like, independent of how it is produced.
 *
 * Kept apart from `pbkdf2.ts` on purpose: that module binds to
 * `react-native-quick-crypto`, so anything importing it drags a native module
 * along. Checking a key's shape needs none of that, and the key manager only
 * ever needs the shape.
 */

const KEY_LENGTH_BYTES = 32;
const KEY_LENGTH_HEX = KEY_LENGTH_BYTES * 2;

export const CLIENT_KEY_LENGTH_BYTES = KEY_LENGTH_BYTES;

export function hexToUint8Array(hex: string): Uint8Array {
  const length = hex.length / 2;
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export function uint8ArrayToHex(bytes: Uint8Array): string {
  let hex = "";
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}

/**
 * A key read back from storage is only usable if it still looks like one. The
 * all-zero key is rejected on top of the shape check: it is what a partially
 * written or zero-filled buffer decodes to, and it would otherwise sail through
 * as a valid-looking key that decrypts nothing.
 */
export function isValidClientKeyHex(hex: string): boolean {
  if (hex.length !== KEY_LENGTH_HEX) return false;
  if (!/^[0-9a-f]+$/i.test(hex)) return false;
  return hex !== "0".repeat(KEY_LENGTH_HEX);
}
