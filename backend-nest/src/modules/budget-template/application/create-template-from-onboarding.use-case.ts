import { Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import {
  DEFAULT_LOCALE,
  type BudgetTemplateCreate,
  type BudgetTemplateCreateFromOnboarding,
  type SupportedLocale,
  type TemplateLineCreateWithoutTemplateId,
  budgetTemplateCreateFromOnboardingSchema,
} from 'pulpe-shared';
import type { TemplateWithLines } from '../domain/budget-template.entity';
import { CreateTemplateUseCase } from './create-template.use-case';

type FixedField =
  | 'monthlyIncome'
  | 'housingCosts'
  | 'healthInsurance'
  | 'phonePlan'
  | 'internetPlan'
  | 'transportCosts'
  | 'leasingCredit';

const ONBOARDING_FIELD_MAPPINGS: readonly {
  field: FixedField;
  kind: 'income' | 'expense';
}[] = [
  { field: 'monthlyIncome', kind: 'income' },
  { field: 'housingCosts', kind: 'expense' },
  { field: 'healthInsurance', kind: 'expense' },
  { field: 'phonePlan', kind: 'expense' },
  { field: 'internetPlan', kind: 'expense' },
  { field: 'transportCosts', kind: 'expense' },
  { field: 'leasingCredit', kind: 'expense' },
];

type LineCopy = Record<
  FixedField,
  readonly [name: string, description: string]
>;
const ONBOARDING_LINE_COPY: Record<SupportedLocale, LineCopy> = {
  fr: {
    monthlyIncome: ['Salaire', 'Salaire & revenus mensuels'],
    housingCosts: ['Loyer', 'Loyer, assurances, etc.'],
    healthInsurance: ['Assurance maladie', 'Assurance maladie, etc.'],
    phonePlan: ['Téléphone', 'Frais de téléphone'],
    internetPlan: ['Internet', 'Abonnement internet'],
    transportCosts: ['Transport', 'Transport en commun, véhicule, etc.'],
    leasingCredit: ['Leasing', 'Crédit, leasing, etc.'],
  },
  en: {
    monthlyIncome: ['Salary', 'Monthly salary & income'],
    housingCosts: ['Rent', 'Rent, insurance, etc.'],
    healthInsurance: ['Health insurance', 'Health insurance, etc.'],
    phonePlan: ['Phone', 'Phone costs'],
    internetPlan: ['Internet', 'Internet subscription'],
    transportCosts: ['Transport', 'Public transport, vehicle, etc.'],
    leasingCredit: ['Leasing', 'Credit, leasing, etc.'],
  },
  de: {
    monthlyIncome: ['Gehalt', 'Gehalt & monatliches Einkommen'],
    housingCosts: ['Miete', 'Miete, Versicherungen usw.'],
    healthInsurance: ['Krankenkasse', 'Krankenkasse usw.'],
    phonePlan: ['Telefon', 'Telefonkosten'],
    internetPlan: ['Internet', 'Internet-Abo'],
    transportCosts: ['Transport', 'Öffentlicher Verkehr, Fahrzeug usw.'],
    leasingCredit: ['Leasing', 'Kredit, Leasing usw.'],
  },
  it: {
    monthlyIncome: ['Stipendio', 'Stipendio e redditi mensili'],
    housingCosts: ['Affitto', 'Affitto, assicurazioni, ecc.'],
    healthInsurance: ['Cassa malati', 'Cassa malati, ecc.'],
    phonePlan: ['Telefono', 'Costi telefonici'],
    internetPlan: ['Internet', 'Abbonamento internet'],
    transportCosts: ['Trasporti', 'Trasporto pubblico, veicolo, ecc.'],
    leasingCredit: ['Leasing', 'Credito, leasing, ecc.'],
  },
};

@Injectable()
export class CreateTemplateFromOnboardingUseCase {
  constructor(
    private readonly createTemplateUseCase: CreateTemplateUseCase,
    @InjectInfoLogger(CreateTemplateFromOnboardingUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    onboardingData: BudgetTemplateCreateFromOnboarding,
    user: AuthenticatedUser,
  ): Promise<TemplateWithLines> {
    const startTime = Date.now();

    const validated =
      budgetTemplateCreateFromOnboardingSchema.parse(onboardingData);

    const lines = this.buildOnboardingTemplateLines(validated);
    const templateCreateDto: BudgetTemplateCreate = {
      name: validated.name || 'Mois Standard',
      description: validated.description,
      isDefault: validated.isDefault,
      lines,
    };

    this.logger.info(
      {
        operation: 'createFromOnboarding',
        userId: user.id,
        duration: Date.now() - startTime,
      },
      'Creating template from onboarding',
    );

    return this.createTemplateUseCase.execute(templateCreateDto, user);
  }

  private buildOnboardingTemplateLines(
    validated: BudgetTemplateCreateFromOnboarding,
  ): TemplateLineCreateWithoutTemplateId[] {
    const lines: TemplateLineCreateWithoutTemplateId[] = [];
    const copy = ONBOARDING_LINE_COPY[validated.locale ?? DEFAULT_LOCALE];

    for (const mapping of ONBOARDING_FIELD_MAPPINGS) {
      const amount = validated[mapping.field] ?? 0;
      if (amount > 0) {
        const [name, description] = copy[mapping.field];
        lines.push({
          name,
          amount,
          kind: mapping.kind,
          recurrence: 'fixed',
          description,
        });
      }
    }

    if (validated.customTransactions) {
      lines.push(
        ...validated.customTransactions.map((t) => ({
          name: t.name,
          amount: t.amount,
          kind: t.type,
          recurrence: t.expenseType,
          description: t.description || '',
        })),
      );
    }

    return lines;
  }
}
