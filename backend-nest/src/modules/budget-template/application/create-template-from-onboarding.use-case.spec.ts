import { beforeEach, describe, expect, it, jest } from 'bun:test';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { InfoLogger } from '@common/logger';
import type { BudgetTemplateCreate, SupportedLocale } from 'pulpe-shared';
import { CreateTemplateFromOnboardingUseCase } from './create-template-from-onboarding.use-case';
import type { CreateTemplateUseCase } from './create-template.use-case';

const USER: AuthenticatedUser = {
  id: 'user-1',
  email: 'test@example.com',
  accessToken: 'token',
  clientKey: Buffer.from('key'),
};
const AMOUNTS = {
  monthlyIncome: 1,
  housingCosts: 2,
  healthInsurance: 3,
  phonePlan: 4,
  internetPlan: 5,
  transportCosts: 6,
  leasingCredit: 7,
};
const BASE = { name: 'Template', isDefault: true, customTransactions: [] };
const COPY: Record<SupportedLocale, readonly (readonly [string, string])[]> = {
  fr: [
    ['Salaire', 'Salaire & revenus mensuels'],
    ['Loyer', 'Loyer, assurances, etc.'],
    ['Assurance maladie', 'Assurance maladie, etc.'],
    ['Téléphone', 'Frais de téléphone'],
    ['Internet', 'Abonnement internet'],
    ['Transport', 'Transport en commun, véhicule, etc.'],
    ['Leasing', 'Crédit, leasing, etc.'],
  ],
  en: [
    ['Salary', 'Monthly salary & income'],
    ['Rent', 'Rent, insurance, etc.'],
    ['Health insurance', 'Health insurance, etc.'],
    ['Phone', 'Phone costs'],
    ['Internet', 'Internet subscription'],
    ['Transport', 'Public transport, vehicle, etc.'],
    ['Leasing', 'Credit, leasing, etc.'],
  ],
  de: [
    ['Gehalt', 'Gehalt & monatliches Einkommen'],
    ['Miete', 'Miete, Versicherungen usw.'],
    ['Krankenkasse', 'Krankenkasse usw.'],
    ['Telefon', 'Telefonkosten'],
    ['Internet', 'Internet-Abo'],
    ['Transport', 'Öffentlicher Verkehr, Fahrzeug usw.'],
    ['Leasing', 'Kredit, Leasing usw.'],
  ],
  it: [
    ['Stipendio', 'Stipendio e redditi mensili'],
    ['Affitto', 'Affitto, assicurazioni, ecc.'],
    ['Cassa malati', 'Cassa malati, ecc.'],
    ['Telefono', 'Costi telefonici'],
    ['Internet', 'Abbonamento internet'],
    ['Trasporti', 'Trasporto pubblico, veicolo, ecc.'],
    ['Leasing', 'Credito, leasing, ecc.'],
  ],
};

describe('CreateTemplateFromOnboardingUseCase', () => {
  let execute: ReturnType<typeof jest.fn>;
  let useCase: CreateTemplateFromOnboardingUseCase;

  beforeEach(() => {
    execute = jest.fn().mockResolvedValue({});
    useCase = new CreateTemplateFromOnboardingUseCase(
      { execute } as unknown as CreateTemplateUseCase,
      { info: jest.fn() } as unknown as InfoLogger,
    );
  });

  it.each(Object.entries(COPY) as [SupportedLocale, (typeof COPY)['fr']][])(
    'uses server-owned %s copy for all fixed lines',
    async (locale, copy) => {
      await useCase.execute({ ...BASE, ...AMOUNTS, locale }, USER);

      const dto = execute.mock.calls[0]![0] as BudgetTemplateCreate;
      expect(
        dto.lines.map(({ name, description }) => [name, description]),
      ).toEqual(copy.map((pair) => [...pair]));
      expect(
        dto.lines.map(({ amount, kind, recurrence }) => ({
          amount,
          kind,
          recurrence,
        })),
      ).toEqual([
        { amount: 1, kind: 'income', recurrence: 'fixed' },
        ...[2, 3, 4, 5, 6, 7].map((amount) => ({
          amount,
          kind: 'expense' as const,
          recurrence: 'fixed' as const,
        })),
      ]);
    },
  );

  it('defaults omitted locale to French and rejects unsupported locales', async () => {
    await useCase.execute({ ...BASE, monthlyIncome: 1 }, USER);
    expect(execute.mock.calls[0]![0].lines[0].name).toBe('Salaire');

    await expect(
      useCase.execute(
        { ...BASE, monthlyIncome: 1, locale: 'es' } as never,
        USER,
      ),
    ).rejects.toThrow();
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('preserves validated custom transaction domain values', async () => {
    const custom = {
      name: 'Gym',
      amount: 42,
      type: 'saving' as const,
      expenseType: 'one_off' as const,
      isRecurring: false,
      description: 'Custom copy',
    };

    await useCase.execute(
      { ...BASE, locale: 'it', customTransactions: [custom] },
      USER,
    );

    expect(execute.mock.calls[0]![0].lines).toEqual([
      {
        name: custom.name,
        amount: custom.amount,
        kind: custom.type,
        recurrence: custom.expenseType,
        description: custom.description,
      },
    ]);
  });
});
