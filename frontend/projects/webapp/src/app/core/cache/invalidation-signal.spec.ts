import { describe, it, expect } from 'vitest';
import { createInvalidationSignal } from './invalidation-signal';

describe('createInvalidationSignal', () => {
  it('should start with version 0', () => {
    const inv = createInvalidationSignal();
    expect(inv.version()).toBe(0);
  });

  it('should increment version on invalidate', () => {
    const inv = createInvalidationSignal();
    inv.invalidate();
    expect(inv.version()).toBe(1);
  });

  it('should increment correctly on multiple invalidations', () => {
    const inv = createInvalidationSignal();
    inv.invalidate();
    inv.invalidate();
    inv.invalidate();
    expect(inv.version()).toBe(3);
  });
});
