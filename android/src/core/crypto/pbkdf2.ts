import { pbkdf2 } from "react-native-quick-crypto";

import {
  CLIENT_KEY_LENGTH_BYTES,
  hexToUint8Array,
  uint8ArrayToHex,
} from "./client-key-format";

/**
 * Client-key derivation, bit-compatible with the web.
 *
 * The webapp derives through `crypto.subtle.deriveBits` in
 * `frontend/.../core/encryption/crypto.utils.ts`. Every parameter below is
 * pinned to what that call passes, because the two have to agree exactly: a key
 * derived here that differs by one bit decrypts nothing the web wrote, and the
 * failure surfaces as unreadable amounts rather than as an error.
 *
 * The salt in particular is *decoded* from hex into bytes before hashing —
 * passing the hex string straight through would hash 64 ASCII characters
 * instead of the 32 bytes they encode, and still return a plausible key.
 */

const DIGEST = "sha256";

/**
 * Derives the client key from the user's PIN.
 *
 * Uses the callback form rather than `pbkdf2Sync`: at the iteration counts the
 * server hands out, a synchronous derivation would block the JS thread long
 * enough to freeze the numpad mid-entry.
 */
export function deriveClientKey(
  password: string,
  saltHex: string,
  iterations: number,
): Promise<string> {
  const salt = hexToUint8Array(saltHex);
  const passwordBytes = new TextEncoder().encode(password);

  return new Promise((resolve, reject) => {
    pbkdf2(
      passwordBytes,
      salt,
      iterations,
      CLIENT_KEY_LENGTH_BYTES,
      DIGEST,
      (error, derivedKey) => {
        if (error) return reject(error);
        if (!derivedKey) {
          return reject(new Error("PBKDF2 returned no key"));
        }
        resolve(uint8ArrayToHex(new Uint8Array(derivedKey)));
      },
    );
  });
}
