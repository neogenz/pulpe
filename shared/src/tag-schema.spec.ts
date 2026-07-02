import { describe, it, expect } from 'vitest';
import { tagCreateSchema, tagUpdateSchema } from '../schemas.js';

describe('tagCreateSchema', () => {
  it('should reject a whitespace-only name (trim before min, else DB CHECK turns it into a 500)', () => {
    const result = tagCreateSchema.safeParse({ name: '   ' });

    expect(result.success).toBe(false);
  });

  it('should trim surrounding whitespace before validating length', () => {
    const paddedThirtyCharName = `  ${'a'.repeat(30)}  `;

    const result = tagCreateSchema.safeParse({ name: paddedThirtyCharName });

    expect(result.success).toBe(true);
    expect(result.data?.name).toBe('a'.repeat(30));
  });

  it('should reject a name longer than 30 characters after trim', () => {
    const result = tagCreateSchema.safeParse({ name: 'a'.repeat(31) });

    expect(result.success).toBe(false);
  });

  it('should reject unknown keys (strict contract)', () => {
    const result = tagCreateSchema.safeParse({ name: 'Voyage', color: 'red' });

    expect(result.success).toBe(false);
  });
});

describe('tagUpdateSchema', () => {
  it('should inherit the whitespace-only rejection from the create schema', () => {
    const result = tagUpdateSchema.safeParse({ name: ' ' });

    expect(result.success).toBe(false);
  });
});
