import { type BudgetLine, type Transaction } from '@pulpe/shared';

/**
 * Métadonnées d'affichage pré-calculées pour éviter les appels de fonctions dans le template
 */
export interface TableItemDisplayMetadata {
  /** Icône Material pour le type (income/expense/saving) */
  kindIcon: string;
  /** Label pour l'action d'allocation ('Saisir une dépense', etc.) */
  allocationLabel: string;
  /** ID du budget source pour les lignes rollover */
  rolloverSourceBudgetId?: string;
}

/**
 * Données de consommation pré-calculées pour une budget line
 */
export interface BudgetLineConsumptionDisplay {
  consumed: number;
  transactionCount: number;
  /** Pourcentage de consommation pré-calculé */
  percentage: number;
  /** Label formaté ('2 dépenses', '1 revenu', etc.) */
  transactionCountLabel: string;
  hasTransactions: boolean;
}

/**
 * Simple table item using composition
 */
export interface TableItem {
  data: BudgetLine | Transaction;
  metadata: {
    itemType: 'budget_line' | 'transaction';
    cumulativeBalance: number;
    isEditing?: boolean;
    isRollover?: boolean;
    isTemplateLinked?: boolean;
    isPropagationLocked?: boolean;
    canResetFromTemplate?: boolean;
    isLoading?: boolean;
    /** Nom de l'enveloppe pour les transactions allouées (mode transactions) */
    envelopeName?: string | null;
  } & TableItemDisplayMetadata;
}

/**
 * ViewModel enrichi pour les budget lines avec données de consommation
 */
export interface BudgetLineTableItem extends TableItem {
  data: BudgetLine;
  consumption?: BudgetLineConsumptionDisplay;
}

/**
 * ViewModel pour les transactions (sans données de consommation)
 */
export interface TransactionTableItem extends TableItem {
  data: Transaction;
}
