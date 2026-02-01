const KEY_LENGTH_BYTES = 32;
const KEY_LENGTH_HEX = KEY_LENGTH_BYTES * 2;

// Deterministic client key for demo mode. Not a secret — demo data is public.
// Allows demo mode to use the same encryption code path as real users.
export const DEMO_CLIENT_KEY =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

export function uint8ArrayToHex(bytes: Uint8Array): string {
  let hex = '';
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, '0');
  }
  return hex;
}

export function hexToUint8Array(hex: string): Uint8Array {
  const length = hex.length / 2;
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export async function deriveClientKey(
  password: string,
  saltHex: string,
  iterations: number,
): Promise<string> {
  const encoder = new TextEncoder();
  const salt = hexToUint8Array(saltHex);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    KEY_LENGTH_BYTES * 8,
  );

  return uint8ArrayToHex(new Uint8Array(derivedBits));
}

export function generateRandomKeyHex(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(KEY_LENGTH_BYTES));
  return uint8ArrayToHex(bytes);
}

export function isValidClientKeyHex(hex: string): boolean {
  if (hex.length !== KEY_LENGTH_HEX) return false;
  if (!/^[0-9a-f]+$/i.test(hex)) return false;
  return hex !== '0'.repeat(KEY_LENGTH_HEX);
}
