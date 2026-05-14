import { Inject, Injectable } from '@nestjs/common';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import { DEMO_CLIENT_KEY_BUFFER } from '@modules/encryption/domain/encryption.constants';
import {
  ENCRYPTION_PORT,
  type EncryptionPort,
} from '@modules/encryption/encryption.tokens';
import type {
  DemoBudgetLineSeed,
  DemoBudgetSeed,
  DemoSeededBudget,
  DemoSeededTemplate,
  DemoSeededTemplateLine,
  DemoTemplateLineSeed,
  DemoTemplateSeed,
  DemoTransactionSeed,
} from '../../domain/demo.entity';
import type {
  DemoRepositoryPort,
  DemoTemplateIds,
} from '../../domain/ports/demo-repository.port';
import type { Tables, TablesInsert } from '../../../../types/database.types';
import {
  getHolidayMonthLines,
  getSavingsMonthLines,
  getStandardMonthLines,
  getVacationMonthLines,
} from './demo-template-specs';

type TemplateInsert = Omit<
  TablesInsert<'template'>,
  'id' | 'created_at' | 'updated_at'
>;
type TemplateLineInsert = Omit<
  TablesInsert<'template_line'>,
  'id' | 'created_at' | 'updated_at'
>;
type BudgetInsert = Omit<
  TablesInsert<'monthly_budget'>,
  'id' | 'created_at' | 'updated_at'
>;
type BudgetLineInsert = Omit<
  TablesInsert<'budget_line'>,
  'id' | 'created_at' | 'updated_at'
>;
type TransactionInsert = Omit<
  TablesInsert<'transaction'>,
  'id' | 'created_at' | 'updated_at'
>;

type TemplateLineRow = Tables<'template_line'>;

@Injectable()
export class SupabaseDemoRepository implements DemoRepositoryPort {
  constructor(
    @Inject(ENCRYPTION_PORT) private readonly encryption: EncryptionPort,
  ) {}

  async insertTemplates(
    templates: DemoTemplateSeed[],
    supabase: AuthenticatedSupabaseClient,
  ): Promise<DemoSeededTemplate[]> {
    const rows: TemplateInsert[] = templates.map((t) => ({
      user_id: t.userId,
      name: t.name,
      description: t.description,
      is_default: t.isDefault,
    }));

    const { data, error } = await supabase
      .from('template')
      .insert(rows)
      .select();

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.INTERNAL_SERVER_ERROR,
        undefined,
        { operation: 'insertDemoTemplates', supabaseError: error },
        { cause: error },
      );
    }

    return (data ?? []).map((row) => ({ id: row.id }));
  }

  async insertCanonicalTemplateLines(
    templateIds: DemoTemplateIds,
    userId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<DemoSeededTemplateLine[]> {
    const seeds: DemoTemplateLineSeed[] = [
      ...getStandardMonthLines(templateIds.standardId),
      ...getVacationMonthLines(templateIds.vacationId),
      ...getSavingsMonthLines(templateIds.savingsId),
      ...getHolidayMonthLines(templateIds.holidayId),
    ];

    if (seeds.length === 0) return [];

    const dek = await this.getDemoDek(userId);

    const rows: TemplateLineInsert[] = seeds.map((seed) => ({
      template_id: seed.templateId,
      name: seed.name,
      amount: this.encryption.encryptAmount(seed.amount, dek),
      kind: seed.kind,
      recurrence: seed.recurrence,
      description: seed.description,
      original_amount: null,
      original_currency: null,
      target_currency: null,
      exchange_rate: null,
    }));

    const { data, error } = await supabase
      .from('template_line')
      .insert(rows)
      .select();

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.INTERNAL_SERVER_ERROR,
        undefined,
        { operation: 'insertDemoTemplateLines', supabaseError: error },
        { cause: error },
      );
    }

    return (data ?? []).map((row) => this.toSeededTemplateLine(row, dek));
  }

  async insertBudgets(
    budgets: DemoBudgetSeed[],
    supabase: AuthenticatedSupabaseClient,
  ): Promise<DemoSeededBudget[]> {
    const rows: BudgetInsert[] = budgets.map((b) => ({
      user_id: b.userId,
      month: b.month,
      year: b.year,
      description: b.description,
      template_id: b.templateId,
      ending_balance: null,
    }));

    const { data, error } = await supabase
      .from('monthly_budget')
      .insert(rows)
      .select();

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.INTERNAL_SERVER_ERROR,
        undefined,
        { operation: 'insertDemoBudgets', supabaseError: error },
        { cause: error },
      );
    }

    return (data ?? []).map((row) => ({
      id: row.id,
      month: row.month,
      year: row.year,
      templateId: row.template_id,
    }));
  }

  async insertBudgetLines(
    lines: DemoBudgetLineSeed[],
    userId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<void> {
    if (lines.length === 0) return;

    const dek = await this.getDemoDek(userId);

    const rows: BudgetLineInsert[] = lines.map((line) => ({
      budget_id: line.budgetId,
      template_line_id: line.templateLineId,
      savings_goal_id: null,
      name: line.name,
      amount: this.encryption.encryptAmount(line.amount, dek),
      kind: line.kind,
      recurrence: line.recurrence,
      is_manually_adjusted: false,
      checked_at: null,
      original_amount: null,
      original_currency: null,
      target_currency: null,
      exchange_rate: null,
    }));

    const { error } = await supabase.from('budget_line').insert(rows);

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.INTERNAL_SERVER_ERROR,
        undefined,
        { operation: 'insertDemoBudgetLines', supabaseError: error },
        { cause: error },
      );
    }
  }

  async insertTransactions(
    transactions: DemoTransactionSeed[],
    userId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<void> {
    if (transactions.length === 0) return;

    const dek = await this.getDemoDek(userId);

    const rows: TransactionInsert[] = transactions.map((tx) => ({
      budget_id: tx.budgetId,
      budget_line_id: null,
      name: tx.name,
      amount: this.encryption.encryptAmount(tx.amount, dek),
      kind: tx.kind,
      category: tx.category,
      transaction_date: tx.transactionDate,
      checked_at: null,
      original_amount: null,
      original_currency: null,
      target_currency: null,
      exchange_rate: null,
    }));

    const { error } = await supabase.from('transaction').insert(rows);

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.INTERNAL_SERVER_ERROR,
        undefined,
        { operation: 'insertDemoTransactions', supabaseError: error },
        { cause: error },
      );
    }
  }

  private async getDemoDek(userId: string): Promise<Buffer> {
    return this.encryption.ensureUserDEK(userId, DEMO_CLIENT_KEY_BUFFER);
  }

  private toSeededTemplateLine(
    row: TemplateLineRow,
    dek: Buffer,
  ): DemoSeededTemplateLine {
    return {
      id: row.id,
      templateId: row.template_id,
      name: row.name,
      amount: row.amount
        ? this.encryption.tryDecryptAmount(row.amount, dek, 0)
        : 0,
      kind: row.kind,
      recurrence: row.recurrence,
    };
  }
}
