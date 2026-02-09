import { FormControl } from '@angular/forms';
import { describe, expect, it } from 'vitest';

import {
  formatRecoveryKeyInput,
  RECOVERY_KEY_PATTERN,
  recoveryKeyValidators,
} from './recovery-key.validator';

describe('recovery-key.validator', () => {
  it('should accept only RFC4648 base32 characters', () => {
    const control = new FormControl('', recoveryKeyValidators);

    control.setValue('ABCD-EFGH-IJKL-MNOP-QRST-UVWX-YZ23-4567');
    expect(control.hasError('pattern')).toBe(false);

    control.setValue('ABCD-EFGH-1234-5678');
    expect(control.hasError('pattern')).toBe(true);
  });

  it('should reject ambiguous digits in pattern', () => {
    expect(RECOVERY_KEY_PATTERN.test('AAAA-BBBB-CCCC-DDDD')).toBe(true);
    expect(RECOVERY_KEY_PATTERN.test('AAAA-BBBB-1CCC-DDDD')).toBe(false);
    expect(RECOVERY_KEY_PATTERN.test('AAAA-BBBB-0CCC-DDDD')).toBe(false);
  });

  it('should normalize and strip unsupported characters', () => {
    expect(formatRecoveryKeyInput('ab10-2!7z')).toBe('AB27-Z');
  });
});
