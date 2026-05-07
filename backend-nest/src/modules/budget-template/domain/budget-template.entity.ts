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
