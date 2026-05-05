import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { describe, it, expect, beforeEach } from 'vitest';

import { provideTranslocoForTest } from '@app/testing/transloco-testing';

import { formatConversion } from './format-conversion';

describe('formatConversion', () => {
  let transloco: TranslocoService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [...provideTranslocoForTest()],
    });
    transloco = TestBed.inject(TranslocoService);
  });

  it('returns empty string when originalAmount is null', () => {
    const result = formatConversion(transloco, null, 'CHF', 1.05);

    expect(result).toBe('');
  });

  it('returns empty string when originalCurrency is null', () => {
    const result = formatConversion(transloco, 100, null, 1.05);

    expect(result).toBe('');
  });

  it('with rate uses convertedFromTooltip key and includes the formatted amount and rate', () => {
    const result = formatConversion(transloco, 100, 'CHF', 1.05);

    expect(result).toContain('100');
    expect(result).toContain('1,05');
  });

  it('without rate uses convertedFromTooltipNoRate key and includes the formatted amount', () => {
    const result = formatConversion(transloco, 100, 'CHF', null);

    expect(result).toContain('100');
    expect(result).not.toContain('taux');
  });

  it('formats CHF amount with fr-CH locale', () => {
    const result = formatConversion(transloco, 1234.5, 'CHF', null);

    expect(result).toContain('CHF');
    // ICU/CLDR fr-CH uses a narrow no-break space for thousands. Assert the digits
    // are all present without depending on the exact separator character so the
    // test stays stable across Node/ICU versions.
    expect(result).toMatch(/1.?234[.,]50/);
  });

  it('formats EUR amount with fr-FR locale', () => {
    const result = formatConversion(transloco, 1234.5, 'EUR', null);

    expect(result).toContain('€');
    // ICU/CLDR fr-FR uses a narrow no-break space for thousands and a comma for
    // decimals. Assert digits + comma without pinning the separator character.
    expect(result).toMatch(/1.?234,50/);
  });
});
