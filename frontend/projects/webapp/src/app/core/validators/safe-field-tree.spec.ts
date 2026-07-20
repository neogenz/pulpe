import { describe, expect, it } from 'vitest';
import type { FieldTree } from '@angular/forms/signals';
import { safeFieldTreeRead } from './safe-field-tree';

describe('safeFieldTreeRead', () => {
  it('should return the field tree when the read succeeds', () => {
    const fieldTree = {} as FieldTree<string>;

    expect(safeFieldTreeRead(() => fieldTree)).toBe(fieldTree);
  });

  it('should return null when the read throws NG0950', () => {
    const result = safeFieldTreeRead<string>(() => {
      throw new Error('NG0950: Input is required but no value is available.');
    });

    expect(result).toBeNull();
  });

  it('should rethrow errors that are not NG0950', () => {
    expect(() =>
      safeFieldTreeRead<string>(() => {
        throw new Error('unexpected failure');
      }),
    ).toThrow('unexpected failure');
  });
});
