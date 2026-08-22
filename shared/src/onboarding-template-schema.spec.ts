import { describe, expect, it } from 'vitest';
import { budgetTemplateCreateFromOnboardingSchema } from '../schemas.js';

describe('budgetTemplateCreateFromOnboardingSchema', () => {
  it.each(['fr', 'en', 'de', 'it'] as const)(
    'accepts the supported locale %s',
    (locale) => {
      expect(
        budgetTemplateCreateFromOnboardingSchema.parse({ locale }).locale,
      ).toBe(locale);
    },
  );

  it('keeps locale optional and rejects unsupported values', () => {
    expect(budgetTemplateCreateFromOnboardingSchema.parse({}).locale).toBe(
      undefined,
    );
    expect(
      budgetTemplateCreateFromOnboardingSchema.safeParse({ locale: 'es' })
        .success,
    ).toBe(false);
  });
});
