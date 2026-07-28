import type { TransactionKind, TransactionRecurrence } from 'pulpe-shared';
import type { TemplateLine } from '../budget-template.entity';

export const TEMPLATE_LINE_PROPAGATION_PORT = Symbol(
  'TEMPLATE_LINE_PROPAGATION_PORT',
);

export interface LinkedTemplateLineCreateInput {
  templateId: string;
  userId: string;
  payDayOfMonth: number | null;
  name: string;
  amount: number;
  kind: TransactionKind;
  recurrence: TransactionRecurrence;
  /** Lien objectif — porté par le modèle, il survit aux régénérations. */
  savingsGoalId: string;
}

/**
 * Crée une template_line sur le Mois Type et la propage aux budgets
 * matérialisés courant+futurs. Le bulk existant conserve la responsabilité du
 * chiffrement, de RG-001, des recalculs et de l'invalidation du cache.
 */
export interface TemplateLinePropagationPort {
  createLineAndPropagate(
    input: LinkedTemplateLineCreateInput,
  ): Promise<TemplateLine>;
}
