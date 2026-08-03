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
type SavingsGoalStatusEnum = Database['public']['Enums']['savings_goal_status'];

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
 *
 * `checkedAt` carries the pointage: months already closed are seeded checked so
 * the demo shows the "Pointé / À pointer" contrast instead of a flat unchecked
 * ledger. It also gates savings goal progress, which only counts checked lines.
 *
 * `spreadGroupId` is the shared identity of a lissage: the tranches of one
 * spread expense are sibling `one_off` lines carrying the same uuid. It is not
 * a financial value, so it is never encrypted.
 */
export interface DemoBudgetLineSeed {
  budgetId: string;
  templateLineId: string | null;
  name: string;
  amount: number;
  kind: TransactionKindEnum;
  recurrence: TransactionRecurrenceEnum;
  checkedAt: string | null;
  spreadGroupId: string | null;
}

/**
 * What the seed needs back after inserting a budget line: the generated id, and
 * enough to pair the line with the actual it consumes or the goal it feeds.
 */
export interface DemoSeededBudgetLine {
  id: string;
  budgetId: string;
  name: string;
  kind: TransactionKindEnum;
}

/**
 * Transaction seed input (entity-shaped). Repo encrypts `amount` internally.
 *
 * `budgetLineId` is the envelope this actual consumes; `null` is legitimate when
 * the month's budget carries no matching prévision.
 */
export interface DemoTransactionSeed {
  budgetId: string;
  budgetLineId: string | null;
  name: string;
  amount: number;
  kind: TransactionKindEnum;
  tagName: string;
  transactionDate: string;
  checkedAt: string | null;
}

/**
 * Savings goal seed input (entity-shaped). Repo encrypts `targetAmount` and
 * `initialAmount` internally. Dates are bare `YYYY-MM-DD`, matching the column.
 */
export interface DemoSavingsGoalSeed {
  userId: string;
  name: string;
  targetAmount: number;
  initialAmount: number;
  status: SavingsGoalStatusEnum;
  startDate: string | null;
  targetDate: string | null;
}

/**
 * Identifier returned by the repo after inserting a savings goal. `name` is
 * what pairs the goal back with the prévisions Épargne that feed it.
 */
export interface DemoSeededSavingsGoal {
  id: string;
  name: string;
}

export type TemplateRow = Tables<'template'>;
export type TemplateLineRow = Tables<'template_line'>;
export type MonthlyBudgetRow = Tables<'monthly_budget'>;
