import { Validators } from '@angular/forms';

/**
 * Recovery key format: groups of 4 alphanumeric chars separated by dashes
 * Example: XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX
 */
export const RECOVERY_KEY_PATTERN = /^[A-Za-z0-9\-\s]+$/;

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
  const stripped = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return stripped.match(/.{1,4}/g)?.join('-') ?? stripped;
}
