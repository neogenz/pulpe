import type { SupportedCurrency } from 'pulpe-shared';
import type { Database } from '../../../types/database.types';

export type TransactionRow = Database['public']['Tables']['transaction']['Row'];
export type TransactionInsert =
  Database['public']['Tables']['transaction']['Insert'];
export type TransactionUpdate =
  Database['public']['Tables']['transaction']['Update'];

type TransactionKind = Database['public']['Enums']['transaction_kind'];

/**
 * Domain entity for a transaction — camelCase, decrypted plain numbers.
 *
 * Repos return this shape. Use cases work with this. The mapper converts to API DTOs.
 */
export interface Transaction {
  id: string;
  budgetId: string;
  budgetLineId: string | null;
  name: string;
  amount: number;
  originalAmount: number | null;
  originalCurrency: string | null;
  targetCurrency: string | null;
  exchangeRate: number | null;
  kind: TransactionKind;
  /** Tags associés (PUL-18) — remplace l'ancien champ libre `category`. */
  tagIds: string[];
  transactionDate: string;
  checkedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /**
   * Origine d'épargne (PUL-329). Trois états, jamais un quatrième : les deux
   * nuls = revenu ordinaire ; les deux présents = lien ACTIF ; identifiant nul
   * et nom présent = lien CASSÉ (l'objectif a été supprimé, la provenance
   * reste lisible). Aucune écriture ne peut les changer après la création.
   */
  sourceSavingsGoalId: string | null;
  sourceSavingsGoalName: string | null;
}

/**
 * Decrypted spread SOURCE: a transaction plus its budget's month/year (M0),
 * the fields the total-preserving spread-from flow needs to validate eligibility
 * (must be a free réel, non-income) and redistribute the total. Fetched in one
 * join so the use case stays I/O-free (PUL-17 v1.1).
 */
export interface SpreadSourceTransaction {
  id: string;
  budgetId: string;
  /** Owner of the parent budget — application-layer IDOR guard (defense-in-depth vs RLS). */
  userId: string;
  budgetLineId: string | null;
  month: number;
  year: number;
  name: string;
  amount: number;
  originalAmount: number | null;
  originalCurrency: SupportedCurrency | null;
  targetCurrency: SupportedCurrency | null;
  exchangeRate: number | null;
  kind: TransactionKind;
}

/**
 * Repo write input for inserts. Plain numbers — repo encrypts internally.
 */
export interface TransactionCreateInput {
  id?: string;
  budgetId: string;
  budgetLineId?: string | null;
  name: string;
  amount: number;
  originalAmount?: number | null;
  originalCurrency?: SupportedCurrency | null;
  targetCurrency?: SupportedCurrency | null;
  exchangeRate?: number | null;
  kind: TransactionKind;
  tagIds?: string[];
  transactionDate: string;
  checkedAt?: string | null;
  /**
   * Objectif d'épargne d'origine (PUL-329). Présent = l'insertion passe par la
   * RPC atomique qui prélève le stock, pas par l'INSERT ordinaire. Le nom
   * snapshot n'est PAS ici : le serveur le fige lui-même sous le verrou, un
   * nom fourni par l'appelant serait déjà périmé.
   */
  sourceSavingsGoalId?: string | null;
}

/**
 * Repo write patch for partial updates. Plain numbers — repo encrypts internally.
 *
 * Currency metadata fields use `undefined` to mean "do not touch", `null` to mean "clear".
 */
export interface TransactionUpdatePatch {
  name?: string;
  amount?: number;
  originalAmount?: number | null;
  originalCurrency?: SupportedCurrency | null;
  targetCurrency?: SupportedCurrency | null;
  exchangeRate?: number | null;
  kind?: TransactionKind;
  /** présent = remplace l'ensemble des tags ; absent = ne touche pas */
  tagIds?: string[];
  transactionDate?: string;
  checkedAt?: string | null;
}

/**
 * L'état d'une transaction juste avant qu'on l'édite ou la supprime (PUL-329).
 *
 * `amount` est déchiffré : c'est lui qui fait le disponible d'une édition
 * (`confirmé + ancien montant`) et le montant restitué par une suppression.
 * `sourceSavingsGoalId` non nul = lien ACTIF, l'écriture passe par la RPC ;
 * nul avec un `sourceSavingsGoalName` = lien CASSÉ, l'écriture reprend le
 * chemin ordinaire sans aucun contrôle de solde — l'objectif n'existe plus,
 * il n'y a plus de stock à protéger.
 */
export interface TransactionMutationContext {
  budgetId: string;
  budgetLineId: string | null;
  kind: TransactionKind;
  amount: number;
  sourceSavingsGoalId: string | null;
  sourceSavingsGoalName: string | null;
}

/**
 * Decrypted budget_line lookup result for transaction allocation validation.
 */
export interface BudgetLineForAllocation {
  id: string;
  budgetId: string;
  kind: TransactionKind;
}

/**
 * Decrypted search result row (transaction or budget_line). Repo decrypts amount
 * before returning so use cases receive plain numbers.
 */
export interface TransactionSearchTransactionRow {
  id: string;
  name: string;
  amount: number;
  kind: string;
  transactionDate: string;
  budgetId: string;
  budget: { description: string; month: number; year: number } | null;
}

export interface TransactionSearchBudgetLineRow {
  id: string;
  name: string;
  amount: number;
  kind: string;
  recurrence: 'fixed' | 'one_off';
  budgetId: string;
  budget: { description: string; month: number; year: number } | null;
}
