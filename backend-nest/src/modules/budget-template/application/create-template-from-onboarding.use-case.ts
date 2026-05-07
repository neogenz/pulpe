import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import {
  type BudgetTemplateCreate,
  type BudgetTemplateCreateFromOnboarding,
  type BudgetTemplateCreateResponse,
  type TemplateLineCreateWithoutTemplateId,
  budgetTemplateCreateFromOnboardingSchema,
} from 'pulpe-shared';
import {
  BUDGET_TEMPLATE_REPOSITORY,
  type BudgetTemplateRepositoryPort,
} from '../domain/ports/budget-template-repository.port';
import { BudgetTemplateInvariants } from '../domain/budget-template.invariants';
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
    @Inject(BUDGET_TEMPLATE_REPOSITORY)
    private readonly repo: BudgetTemplateRepositoryPort,
    private readonly createTemplateUseCase: CreateTemplateUseCase,
    @InjectInfoLogger(CreateTemplateFromOnboardingUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    onboardingData: BudgetTemplateCreateFromOnboarding,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetTemplateCreateResponse> {
    const startTime = Date.now();

    const validated =
      budgetTemplateCreateFromOnboardingSchema.parse(onboardingData);

    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
    const recentCount = await this.repo.countOnboardingTemplatesInWindow(
      user.id,
      twentyFourHoursAgo.toISOString(),
      supabase,
    );
    BudgetTemplateInvariants.validateOnboardingRateLimit(recentCount);

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

    return this.createTemplateUseCase.execute(
      templateCreateDto,
      user,
      supabase,
    );
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
