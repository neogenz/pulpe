import { type Budget as BudgetApi } from 'pulpe-shared';

export interface BudgetApiSource {
  id: string;
  createdAt: string;
  updatedAt: string;
  userId: string | null;
  templateId: string;
  month: number;
  year: number;
  description: string;
  endingBalance: number | null;
  remaining?: number;
}

export function mapBudgetToApi(entity: BudgetApiSource): BudgetApi {
  const budget: BudgetApi = {
    id: entity.id,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
    userId: entity.userId ?? undefined,
    templateId: entity.templateId,
    month: entity.month,
    year: entity.year,
    description: entity.description,
    endingBalance: entity.endingBalance ?? undefined,
  };

  if (entity.remaining !== undefined) {
    budget.remaining = entity.remaining;
  }

  return budget;
}

export function mapBudgetsToApi(
  entities: readonly BudgetApiSource[],
): BudgetApi[] {
  return entities.map((entity) => mapBudgetToApi(entity));
}
