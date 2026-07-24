import type {
  BudgetPeriod,
  TransactionKind,
  TransactionRecurrence,
} from 'pulpe-shared';
import type { TemplateLine } from '../budget-template.entity';

export const TEMPLATE_LINE_PROPAGATION_PORT = Symbol(
  'TEMPLATE_LINE_PROPAGATION_PORT',
);

export interface LinkedTemplateLineCreateInput {
  templateId: string;
  userId: string;
  name: string;
  amount: number;
  kind: TransactionKind;
  recurrence: TransactionRecurrence;
  /** Lien objectif (PUL-285 CA2) — porté par le modèle, il survit aux régénérations. */
  savingsGoalId: string;
  /**
   * Dernière période recevant la ligne (PUL-311), incluse. Sans elle la
   * propagation atteindrait tous les budgets futurs et engagerait de l'épargne
   * après l'échéance de l'objectif.
   */
  maxPeriod?: BudgetPeriod;
}

/**
 * Crée une template_line sur le Mois Type et la propage aux budgets
 * matérialisés courant+futurs (sémantique RG-001 : budgets manuellement
 * ajustés protégés, montants chiffrés par le repository, recalcul et
 * invalidation de cache inclus). Port cross-module (pattern PUL-17) — même
 * machinerie que l'endpoint bulk template-line operations.
 */
export interface TemplateLinePropagationPort {
  createLineAndPropagate(
    input: LinkedTemplateLineCreateInput,
  ): Promise<TemplateLine>;
}
