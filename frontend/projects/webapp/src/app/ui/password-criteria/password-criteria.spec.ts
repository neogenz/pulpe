import { describe, expect, it } from 'vitest';
import { passwordCriteria } from './password-criteria';

// La logique est testée en pur (pas de TestBed) : l'env vitest JIT ne lie pas
// les inputs signal après la première instanciation d'un type, donc piloter le
// composant via `setInput` est non-fiable — cf. le même contournement documenté
// dans `oauth-provider-button`.
describe('passwordCriteria', () => {
  const MIN_LENGTH = 8;

  function met(password: string): Record<string, boolean> {
    return Object.fromEntries(
      passwordCriteria(password, MIN_LENGTH).map((criterion) => [
        criterion.labelKey,
        criterion.isMet,
      ]),
    );
  }

  it('flags every criterion unmet on an empty password', () => {
    expect(met('')).toEqual({
      'form.passwordCriteria.minLength': false,
      'form.passwordCriteria.hasNumber': false,
      'form.passwordCriteria.hasLetter': false,
    });
  });

  it('flags only the missing number on a long letters-only password', () => {
    expect(met('abcdefgh')).toEqual({
      'form.passwordCriteria.minLength': true,
      'form.passwordCriteria.hasNumber': false,
      'form.passwordCriteria.hasLetter': true,
    });
  });

  it('flags only the missing letter on a digits-only password', () => {
    expect(met('12345678')).toEqual({
      'form.passwordCriteria.minLength': true,
      'form.passwordCriteria.hasNumber': true,
      'form.passwordCriteria.hasLetter': false,
    });
  });

  it('meets everything on a valid password, including non-ASCII letters', () => {
    expect(met('abcd1234')).toEqual({
      'form.passwordCriteria.minLength': true,
      'form.passwordCriteria.hasNumber': true,
      'form.passwordCriteria.hasLetter': true,
    });
    expect(met('héllø123')['form.passwordCriteria.hasLetter']).toBe(true);
  });
});
