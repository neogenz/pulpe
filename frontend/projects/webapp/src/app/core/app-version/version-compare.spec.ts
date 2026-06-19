import { describe, expect, it } from 'vitest';

import { isVersionBelow } from './version-compare';

describe('isVersionBelow', () => {
  it('should return true when current is below minimum', () => {
    expect(isVersionBelow('0.34.0', '0.35.0')).toBe(true);
  });

  it('should return false when current equals minimum', () => {
    expect(isVersionBelow('0.35.0', '0.35.0')).toBe(false);
  });

  it('should return false when current is above minimum', () => {
    expect(isVersionBelow('1.0.0', '0.35.0')).toBe(false);
  });

  it('should compare segments numerically, not lexically', () => {
    expect(isVersionBelow('1.0.10', '1.0.2')).toBe(false);
    expect(isVersionBelow('1.0.2', '1.0.10')).toBe(true);
  });

  it('should compare major before minor and patch', () => {
    expect(isVersionBelow('1.9.9', '2.0.0')).toBe(true);
    expect(isVersionBelow('2.0.0', '1.9.9')).toBe(false);
  });
});
