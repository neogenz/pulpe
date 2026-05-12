import { Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import {
  type BudgetTemplateCreate,
  type BudgetTemplateCreateFromOnboarding,
  type TemplateLineCreateWithoutTemplateId,
  budgetTemplateCreateFromOnboardingSchema,
} from 'pulpe-shared';
import type { TemplateWithLines } from '../domain/budget-template.entity';
import { CreateTemplateUseCase } from './create-template.use-case';

const ONBOARDING_FIELD_MAPPINGS = [
  {
    field: 'monthlyIncome',
    name: 'Salaire',
    kind: 'income',
    description: 'Salaire & revenus mensuels',
  },
  {
    field: 'housingCosts',
    name: 'Loyer',
    kind: 'expense',
    description: 'Loyer, assurances, etc.',
  },
  {
    field: 'healthInsurance',
    name: 'Assurance maladie',
    kind: 'expense',
    description: 'Assurance maladie, etc.',
  },
  {
    field: 'phonePlan',
    name: 'Téléphone',
    kind: 'expense',
    description: 'Frais de téléphone',
  },
  {
    field: 'internetPlan',
    name: 'Internet',
    kind: 'expense',
    description: 'Abonnement internet',
  },
  {
    field: 'transportCosts',
    name: 'Transport',
    kind: 'expense',
    description: 'Transport en commun, véhicule, etc.',
  },
  {
    field: 'leasingCredit',
    name: 'Leasing',
    kind: 'expense',
    description: 'Crédit, leasing, etc.',
  },
];

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

    for (const mapping of ONBOARDING_FIELD_MAPPINGS) {
      const amount = validated[
        mapping.field as keyof typeof validated
      ] as number;
      if (amount > 0) {
        lines.push({
          name: mapping.name,
          amount,
          kind: mapping.kind as 'income' | 'expense' | 'saving',
          recurrence: 'fixed',
          description: mapping.description,
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
