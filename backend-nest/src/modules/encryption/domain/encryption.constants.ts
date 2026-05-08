/**
 * Deterministic clientKey used by demo mode (frontend + backend).
 * Not a secret — demo data is public. Kept as a domain constant so non-crypto
 * layers (demo seeding) can import it without crossing into infrastructure/.
 */
export const DEMO_CLIENT_KEY_BUFFER = Buffer.from(
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  'hex',
);

export const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
export const ENCRYPTION_IV_LENGTH = 12;
export const ENCRYPTION_AUTH_TAG_LENGTH = 16;
export const ENCRYPTION_KEY_LENGTH = 32;
export const ENCRYPTION_SALT_LENGTH = 16;
export const ENCRYPTION_KDF_ITERATIONS = 600_000;
export const ENCRYPTION_HKDF_DIGEST = 'sha256';
export const ENCRYPTION_DEK_CACHE_TTL_MS = 5 * 60 * 1000;

/** Base32 alphabet (RFC 4648, no padding) — avoids 0/O and 1/l ambiguity. */
export const ENCRYPTION_BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
