/**
 * Recovery key presentation, mirroring `RecoveryKeyFormatter.swift` and
 * `recovery-key.validator.ts`: RFC 4648 base32 (A-Z, 2-7 — no 0/1/8/9, which
 * read as O/I/B/g on a phone screen), shown in groups of four.
 *
 * The server decides what a valid key is; this only decides what the user
 * sees and when the submit button lights up.
 */

const BASE32_ALPHABET = /[^A-Z2-7]/g;
const GROUP_SIZE = 4;

/** Every key the server mints is this long once the dashes are removed. */
export const RECOVERY_KEY_LENGTH = 52;

/** Drops separators and anything outside the alphabet, uppercasing the rest. */
export function stripRecoveryKey(input: string): string {
  return input.toUpperCase().replace(BASE32_ALPHABET, "");
}

/** `ABCDEFGH` → `ABCD-EFGH`. */
export function formatRecoveryKey(input: string): string {
  const stripped = stripRecoveryKey(input);
  const groups = stripped.match(new RegExp(`.{1,${GROUP_SIZE}}`, "g"));
  return groups?.join("-") ?? stripped;
}

export function isCompleteRecoveryKey(input: string): boolean {
  return stripRecoveryKey(input).length === RECOVERY_KEY_LENGTH;
}

/**
 * True when the user typed something the alphabet has no room for — a warning
 * worth showing as they type, rather than after a round trip.
 */
export function hasInvalidRecoveryKeyCharacters(input: string): boolean {
  return /[^A-Z2-7\-\s]/.test(input.toUpperCase());
}
