import { describe, it, expect, beforeEach, afterEach, spyOn } from 'bun:test';
import { Test } from '@nestjs/testing';
import { CurrencyService } from '../currency.service';
import { INFO_LOGGER_TOKEN } from '@common/logger';
import { createMockPinoLogger } from '../../../test/test-mocks';

type FxDto = {
  amount?: number;
  name?: string;
  originalAmount?: number | null;
  originalCurrency?: string | null;
  targetCurrency?: string;
  exchangeRate?: number | null;
};

const FX_RATE = 0.94;

function mockFetchAnyPair() {
  return spyOn(globalThis, 'fetch').mockImplementation(((
    input: RequestInfo | URL,
  ) => {
    const url = typeof input === 'string' ? input : input.toString();
    const symbols = new URL(url).searchParams.get('symbols') ?? 'EUR';
    return Promise.resolve(
      new Response(
        JSON.stringify({
          base: 'CHF',
          date: '2026-04-19',
          rates: { [symbols]: FX_RATE },
        }),
        { status: 200 },
      ),
    );
  }) as unknown as typeof fetch);
}

describe('CurrencyService — FX transitions (S3-F1)', () => {
  let service: CurrencyService;
  let fetchSpy: ReturnType<typeof spyOn>;

  beforeEach(async () => {
    const mockLogger = createMockPinoLogger();
    const module = await Test.createTestingModule({
      providers: [
        CurrencyService,
        {
          provide: `${INFO_LOGGER_TOKEN}:${CurrencyService.name}`,
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get(CurrencyService);
    fetchSpy = mockFetchAnyPair();
  });

  afterEach(() => {
    fetchSpy?.mockRestore();
  });

  // Transition 1: Create EUR→CHF (FX override), then PATCH same-currency (CHF)
  // Expected: the PATCH must force-null the 3 source FX fields so any orphan
  // metadata that remained from the previous state gets cleared in DB.
  // target_currency is the budget display currency and stays as-is from the client.
  it('should clear source FX fields on PATCH same-currency after cross-currency create', async () => {
    const createDto: FxDto = {
      amount: 94,
      name: 'Rent',
      originalAmount: 100,
      originalCurrency: 'EUR',
      targetCurrency: 'CHF',
      exchangeRate: 0.5, // forged rate — should be overwritten by server
    };
    const createResult = await service.overrideExchangeRate(createDto);

    expect(createResult).toEqual({
      amount: 94,
      name: 'Rent',
      originalAmount: 100,
      originalCurrency: 'EUR',
      targetCurrency: 'CHF',
      exchangeRate: 0.94,
    });

    const patchDto: FxDto = {
      amount: 94,
      originalAmount: 100,
      originalCurrency: 'CHF',
      targetCurrency: 'CHF',
      exchangeRate: 0.94,
    };
    const patchResult = await service.overrideExchangeRate(patchDto);

    expect(patchResult).toEqual({
      amount: 94,
      originalAmount: null,
      originalCurrency: null,
      exchangeRate: null,
      targetCurrency: 'CHF',
    });
  });

  // Transition 2: Create same-currency (CHF with no FX override), then PATCH
  // to introduce an EUR→CHF FX override. Expected: FX fields are populated
  // with the server-fetched rate; target_currency stays CHF.
  it('should populate FX fields on PATCH from same-currency to cross-currency', async () => {
    const createDto: FxDto = {
      amount: 100,
      name: 'Rent',
      targetCurrency: 'CHF',
    };
    const createResult = await service.overrideExchangeRate(createDto);

    expect(createResult).toEqual({
      amount: 100,
      name: 'Rent',
      targetCurrency: 'CHF',
      originalAmount: null,
      originalCurrency: null,
      exchangeRate: null,
    });

    const patchDto: FxDto = {
      amount: 94,
      originalAmount: 100,
      originalCurrency: 'EUR',
      targetCurrency: 'CHF',
    };
    const patchResult = await service.overrideExchangeRate(patchDto);

    expect(patchResult).toEqual({
      amount: 94,
      originalAmount: 100,
      originalCurrency: 'EUR',
      targetCurrency: 'CHF',
      exchangeRate: 0.94,
    });
  });

  // Transition 3: Create same-currency directly (budget CHF, no FX override).
  // Service emits explicit nulls for the 3 source FX fields so the row lands in
  // CHECK state 2 (target present, all source NULL) regardless of any pre-existing
  // stale source columns. target_currency is preserved from client.
  it('should emit explicit source FX nulls on direct same-currency create', async () => {
    const createDto: FxDto = {
      amount: 100,
      name: 'Rent',
      targetCurrency: 'CHF',
    };
    const result = await service.overrideExchangeRate(createDto);

    expect(result).toEqual({
      amount: 100,
      name: 'Rent',
      targetCurrency: 'CHF',
      originalAmount: null,
      originalCurrency: null,
      exchangeRate: null,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // Transition 3-bis (PUL bug repro): row already in DB state 3 (full FX override
  // EUR→CHF). Client PATCHes ONLY targetCurrency to match the existing original
  // currency (e.g. user collapses cross-currency line into same-currency by
  // changing the budget display currency). overrideExchangeRate receives only
  // { targetCurrency } so #buildMissingPairFx is taken with touchesSourceFx=false
  // and previously emitted ONLY targetCurrency. The repository UPDATE then left
  // original_amount/original_currency/exchange_rate untouched in DB, producing
  // a row where original_currency == target_currency, which violates the
  // fx_metadata_coherent CHECK (state 3 requires original_currency <> target_currency).
  // Service must force-null the 3 source FX fields so the row reaches state 2.
  it('should clear source FX fields when patching targetCurrency only to match existing originalCurrency', async () => {
    const patchDto: FxDto = {
      targetCurrency: 'CHF',
    };
    const result = await service.overrideExchangeRate(patchDto);

    expect(result).toEqual({
      originalAmount: null,
      originalCurrency: null,
      exchangeRate: null,
      targetCurrency: 'CHF',
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // Transition 4 (explicit null): schema contract says originalCurrency is
  // `.nullable().optional()` — clients MAY send `null` explicitly. Must produce
  // a DB-valid state (CHECK state 2: target present, no FX override) without
  // leaking an orphan original_currency='null' pair.
  it('should force-null all source FX fields when originalCurrency is explicitly null', async () => {
    const patchDto: FxDto = {
      amount: 100,
      originalCurrency: null,
      targetCurrency: 'CHF',
    };
    const result = await service.overrideExchangeRate(patchDto);

    expect(result).toEqual({
      amount: 100,
      originalAmount: null,
      originalCurrency: null,
      exchangeRate: null,
      targetCurrency: 'CHF',
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
