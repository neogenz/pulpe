import type {
  SupportedCurrency,
  TemplateLinesPropagationSummary,
} from 'pulpe-shared';
import type {
  Database,
  Tables,
  TablesInsert,
} from '../../../types/database.types';

export type TemplateRow = Tables<'template'>;
export type TemplateInsert = TablesInsert<'template'>;
export type TemplateUpdate = Partial<TablesInsert<'template'>>;

export type TemplateLineRow = Tables<'template_line'>;
export type TemplateLineInsert = TablesInsert<'template_line'>;

export type MonthlyBudgetRow = Tables<'monthly_budget'>;

export type TransactionKindEnum =
  Database['public']['Enums']['transaction_kind'];
export type TransactionRecurrenceEnum =
  Database['public']['Enums']['transaction_recurrence'];

/**
 * Domain entity for a budget template — camelCase, plain types.
 *
 * Repos return this shape. Use cases work with this. The mapper converts to API DTOs.
 */
export interface BudgetTemplate {
  id: string;
  userId: string | null;
  name: string;
  description: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Domain entity for a template line — camelCase, decrypted plain numbers.
 *
 * Canonical owner of the template-line shape. Other modules (budget-line)
 * consume this type via cross-module domain import.
 */
export interface TemplateLine {
  id: string;
  templateId: string;
  name: string;
  amount: number;
  originalAmount: number | null;
  originalCurrency: SupportedCurrency | null;
  targetCurrency: SupportedCurrency | null;
  exchangeRate: number | null;
  kind: TransactionKindEnum;
  recurrence: TransactionRecurrenceEnum;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Repo write patch for partial template updates.
 */
export interface BudgetTemplateUpdatePatch {
  name?: string;
  description?: string | null;
  isDefault?: boolean;
}

/**
 * Repo write input for individual template line inserts. Plain numbers — repo encrypts internally.
 */
export interface TemplateLineCreateInput {
  templateId: string;
  name: string;
  amount: number;
  originalAmount?: number | null;
  originalCurrency?: SupportedCurrency | null;
  targetCurrency?: SupportedCurrency | null;
  exchangeRate?: number | null;
  kind: TransactionKindEnum;
  recurrence: TransactionRecurrenceEnum;
  description: string;
}

/**
 * Repo write patch for partial template-line updates. Plain numbers — repo encrypts internally.
 *
 * Currency metadata fields use `undefined` to mean "do not touch", `null` to mean "clear".
 */
export interface TemplateLineUpdatePatch {
  name?: string;
  amount?: number;
  originalAmount?: number | null;
  originalCurrency?: SupportedCurrency | null;
  targetCurrency?: SupportedCurrency | null;
  exchangeRate?: number | null;
  kind?: TransactionKindEnum;
  recurrence?: TransactionRecurrenceEnum;
  description?: string;
}

/**
 * Input shape for `create_template_with_lines` RPC orchestration. Plain numbers —
 * repo encrypts amounts and validates Zod payload internally before the RPC call.
 */
export interface CreateTemplateWithLinesInput {
  userId: string;
  name: string;
  description: string | undefined;
  isDefault: boolean;
  lines: TemplateLineRpcInput[];
}

/**
 * Plain-number line shape used for both `create_template_with_lines` payloads and
 * `apply_template_line_operations` create payloads. Repo encrypts amounts internally.
 */
export interface TemplateLineRpcInput {
  name: string;
  amount: number;
  originalAmount: number | null;
  originalCurrency: SupportedCurrency | null;
  targetCurrency: SupportedCurrency | null;
  exchangeRate: number | null;
  kind: TransactionKindEnum;
  recurrence: TransactionRecurrenceEnum;
  description: string;
}

/**
 * Plain-number patch shape for `apply_template_line_operations` updated_lines.
 * Repo encrypts amounts internally and validates the Zod RPC payload before
 * calling the RPC.
 *
 * `null` semantics: only FX-pair fields (`originalAmount`, `originalCurrency`,
 * `targetCurrency`, `exchangeRate`) accept `null` — used when caller wants to
 * clear an existing FX conversion. Core fields (`name`, `amount`, `description`,
 * `kind`, `recurrence`) reject `null` because the wire schema
 * (`templateLineUpdateSchema`) is `.optional()` only — `undefined` means
 * "preserve existing", and clearing makes no business sense for these.
 */
export interface TemplateLineRpcUpdate {
  id: string;
  name?: string;
  amount?: number;
  originalAmount?: number | null;
  originalCurrency?: SupportedCurrency | null;
  targetCurrency?: SupportedCurrency | null;
  exchangeRate?: number | null;
  kind?: TransactionKindEnum;
  recurrence?: TransactionRecurrenceEnum;
  description?: string;
}

/**
 * Bulk operations input for `apply_template_line_operations`. Both updated and
 * created lines are post-insert items with assigned `id`s — repo encrypts
 * amounts internally and validates Zod payload before invoking the RPC.
 */
export interface BulkTemplateLineOperationsInput {
  templateId: string;
  budgetIds: string[];
  deleteIds: string[];
  updatedLines: TemplateLineRpcUpdate[];
  createdLines: TemplateLineRpcUpdate[];
}

export interface TemplateUsageBudget {
  id: string;
  month: number;
  year: number;
  description: string;
}

/**
 * Composite — a template with its lines, returned by create flows.
 */
export interface TemplateWithLines {
  template: BudgetTemplate;
  lines: TemplateLine[];
}

/**
 * Result of `bulk-template-line-operations` use case — entities returned
 * for created/updated, IDs for deleted, plus propagation summary metadata.
 */
export interface BulkTemplateLineOperationsResult {
  deletedIds: string[];
  updatedLines: TemplateLine[];
  createdLines: TemplateLine[];
  propagation: TemplateLinesPropagationSummary;
}
