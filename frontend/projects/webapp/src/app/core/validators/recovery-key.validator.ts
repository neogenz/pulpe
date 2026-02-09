import { Validators } from '@angular/forms';

/**
 * Recovery key format: groups of 4 RFC4648 base32 chars separated by dashes.
 * Allowed alphabet: A-Z and 2-7 (no 0/1/8/9 to avoid ambiguity).
 * Example: XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX
 */
export const RECOVERY_KEY_PATTERN = /^[A-Za-z2-7\-\s]+$/;

/**
 * Validators for recovery key form controls
 */
export const recoveryKeyValidators = [
  Validators.required,
  Validators.pattern(RECOVERY_KEY_PATTERN),
];

/**
 * Formats recovery key input: uppercase, groups of 4 chars separated by dashes
 * @param value Raw input value
 * @returns Formatted recovery key (e.g., "XXXX-XXXX-XXXX-XXXX")
 */
export function formatRecoveryKeyInput(value: string): string {
  const stripped = value.toUpperCase().replace(/[^A-Z2-7]/g, '');
  return stripped.match(/.{1,4}/g)?.join('-') ?? stripped;
}
