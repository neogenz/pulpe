import type { Database, Tables } from '../../../types/database.types';
import type { DemoAuthUser, DemoAuthSession } from './auth.types';

export interface DemoCredentials {
  email: string;
  password: string;
}

export interface DemoUser {
  userId: string;
  user: DemoAuthUser;
}

export interface DemoSession {
  session: DemoAuthSession;
  user: DemoAuthUser;
}

type TransactionKindEnum = Database['public']['Enums']['transaction_kind'];
type TransactionRecurrenceEnum =
  Database['public']['Enums']['transaction_recurrence'];

/**
 * Template seed input (entity-shaped). Repo writes directly — no amounts to encrypt here.
 */
export interface DemoTemplateSeed {
  userId: string;
  name: string;
  description: string;
  isDefault: boolean;
}

/**
 * Identifier returned by the repo after inserting a template.
 */
export interface DemoSeededTemplate {
  id: string;
}

/**
 * Template line seed input (entity-shaped). Repo encrypts `amount` with `DEMO_CLIENT_KEY_BUFFER` internally.
 */
export interface DemoTemplateLineSeed {
  templateId: string;
  name: string;
  amount: number;
  kind: TransactionKindEnum;
  recurrence: TransactionRecurrenceEnum;
  description: string;
}

/**
 * Identifier and shape returned by the repo after inserting a template line.
 * The repo decrypts `amount` so callers receive plain numbers.
 */
export interface DemoSeededTemplateLine {
  id: string;
  templateId: string;
  name: string;
  amount: number;
  kind: TransactionKindEnum;
  recurrence: TransactionRecurrenceEnum;
}

/**
 * Monthly budget seed input (entity-shaped).
 */
export interface DemoBudgetSeed {
  userId: string;
  month: number;
  year: number;
  description: string;
  templateId: string;
}

/**
 * Identifier returned by the repo after inserting a budget.
 */
export interface DemoSeededBudget {
  id: string;
  month: number;
  year: number;
  templateId: string;
}

/**
 * Budget line seed input (entity-shaped). Repo encrypts `amount` internally.
 */
export interface DemoBudgetLineSeed {
  budgetId: string;
  templateLineId: string | null;
  name: string;
  amount: number;
  kind: TransactionKindEnum;
  recurrence: TransactionRecurrenceEnum;
}

/**
 * Transaction seed input (entity-shaped). Repo encrypts `amount` internally.
 */
export interface DemoTransactionSeed {
  budgetId: string;
  name: string;
  amount: number;
  kind: TransactionKindEnum;
  category: string;
  transactionDate: string;
}

export type TemplateRow = Tables<'template'>;
export type TemplateLineRow = Tables<'template_line'>;
export type MonthlyBudgetRow = Tables<'monthly_budget'>;
