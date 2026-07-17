import { Inject, Injectable } from '@nestjs/common';
import type { Buffer } from 'node:buffer';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { AuthenticatedSupabaseProvider } from '@modules/supabase/authenticated-supabase.provider';
import {
  ENCRYPTION_PORT,
  type EncryptionPort,
} from '@modules/encryption/domain/ports/encryption.port';
import { periodIndex, type BudgetPeriod } from 'pulpe-shared';
import type { TagRepositoryPort } from '../../domain/ports/tag-repository.port';
import type {
  Tag,
  TagCreateInput,
  TagHistoryContribution,
  TagHistoryContributions,
  TagInsert,
  TagRow,
  TagUpdatePatch,
} from '../../domain/tag.entity';

const POSTGRES_UNIQUE_VIOLATION = '23505';
const POSTGREST_NO_ROWS = 'PGRST116';

interface HistoryBudgetRow {
  id: string;
  month: number;
  year: number;
}

interface TaggedAmountRow {
  amount: string;
  budget_id: string;
  kind: string;
}

interface BudgetLineTagHistoryRow {
  budget_line: TaggedAmountRow | null;
}

interface TransactionTagHistoryRow {
  transaction: TaggedAmountRow | null;
}

@Injectable()
export class SupabaseTagRepository implements TagRepositoryPort {
  constructor(
    private readonly supabaseProvider: AuthenticatedSupabaseProvider,
    @Inject(ENCRYPTION_PORT) private readonly encryption: EncryptionPort,
  ) {}

  async findAll(): Promise<Tag[]> {
    const supabase = this.supabaseProvider.client;
    const { data, error } = await supabase
      .from('tag')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TAG_FETCH_FAILED,
        undefined,
        {
          operation: 'listTags',
          entityType: 'tag',
          supabaseError: error,
        },
        { cause: error },
      );
    }

    return (data ?? []).map((row) => this.toEntity(row));
  }

  async findById(id: string): Promise<Tag> {
    const supabase = this.supabaseProvider.client;
    const { data, error } = await supabase
      .from('tag')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TAG_NOT_FOUND,
        { id },
        {
          operation: 'getTag',
          entityId: id,
          entityType: 'tag',
          supabaseError: error,
        },
      );
    }

    return this.toEntity(data);
  }

  async findHistoryContributions(
    id: string,
    startPeriod: BudgetPeriod,
    endPeriod: BudgetPeriod,
  ): Promise<TagHistoryContributions> {
    const budgets = await this.findHistoryBudgets(id, startPeriod, endPeriod);
    if (!budgets.length) return { planned: [], actual: [] };

    const budgetIds = budgets.map((budget) => budget.id);
    const supabase = this.supabaseProvider.client;
    const [plannedResult, actualResult] = await Promise.all([
      supabase
        .from('budget_line_tag')
        .select('budget_line!inner(amount, kind, budget_id)')
        .eq('tag_id', id)
        .in('budget_line.budget_id', budgetIds)
        .eq('budget_line.kind', 'expense'),
      supabase
        .from('transaction_tag')
        .select('transaction!inner(amount, kind, budget_id)')
        .eq('tag_id', id)
        .in('transaction.budget_id', budgetIds)
        .eq('transaction.kind', 'expense'),
    ]);

    const historyError = plannedResult.error ?? actualResult.error;
    if (historyError) throw this.historyFetchError(id, historyError);

    const dek = await this.encryption.getDekFor(this.supabaseProvider.user);
    const periodsByBudgetId = new Map(
      budgets.map((budget) => [budget.id, budget]),
    );
    return {
      planned: this.toHistoryContributions(
        (plannedResult.data ?? []) as unknown as BudgetLineTagHistoryRow[],
        'budget_line',
        periodsByBudgetId,
        dek,
      ),
      actual: this.toHistoryContributions(
        (actualResult.data ?? []) as unknown as TransactionTagHistoryRow[],
        'transaction',
        periodsByBudgetId,
        dek,
      ),
    };
  }

  async insert(input: TagCreateInput): Promise<Tag> {
    const supabase = this.supabaseProvider.client;
    const user = this.supabaseProvider.user;
    const row: TagInsert = { user_id: user.id, name: input.name };

    const { data, error } = await supabase
      .from('tag')
      .insert(row)
      .select('*')
      .single();

    if (error?.code === POSTGRES_UNIQUE_VIOLATION) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TAG_ALREADY_EXISTS,
        { name: input.name },
        {
          operation: 'createTag',
          entityType: 'tag',
          userId: user.id,
        },
        { cause: error },
      );
    }

    if (error || !data) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TAG_CREATE_FAILED,
        undefined,
        {
          operation: 'createTag',
          entityType: 'tag',
          userId: user.id,
          supabaseError: error,
        },
        { cause: error ?? undefined },
      );
    }

    return this.toEntity(data);
  }

  async update(id: string, patch: TagUpdatePatch): Promise<Tag> {
    const supabase = this.supabaseProvider.client;
    const user = this.supabaseProvider.user;
    const updateRow: Partial<TagInsert> = {};
    if (patch.name !== undefined) updateRow.name = patch.name;

    const { data, error } = await supabase
      .from('tag')
      .update(updateRow)
      .eq('id', id)
      .select('*')
      .single();

    if (error?.code === POSTGRES_UNIQUE_VIOLATION) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TAG_ALREADY_EXISTS,
        { name: patch.name },
        {
          operation: 'updateTag',
          entityId: id,
          entityType: 'tag',
          userId: user.id,
        },
        { cause: error },
      );
    }

    if (error?.code === POSTGREST_NO_ROWS || (!error && !data)) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TAG_NOT_FOUND,
        { id },
        {
          operation: 'updateTag',
          entityId: id,
          entityType: 'tag',
          userId: user.id,
          supabaseError: error,
        },
        { cause: error ?? undefined },
      );
    }

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TAG_UPDATE_FAILED,
        { id },
        {
          operation: 'updateTag',
          entityId: id,
          entityType: 'tag',
          userId: user.id,
          supabaseError: error,
        },
        { cause: error },
      );
    }

    return this.toEntity(data);
  }

  async delete(id: string): Promise<void> {
    const supabase = this.supabaseProvider.client;
    const { error } = await supabase.from('tag').delete().eq('id', id);

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TAG_DELETE_FAILED,
        { id },
        {
          operation: 'deleteTag',
          entityId: id,
          entityType: 'tag',
          supabaseError: error,
        },
        { cause: error },
      );
    }
  }

  private async findHistoryBudgets(
    tagId: string,
    startPeriod: BudgetPeriod,
    endPeriod: BudgetPeriod,
  ): Promise<HistoryBudgetRow[]> {
    const { data, error } = await this.supabaseProvider.client
      .from('monthly_budget')
      .select('id, month, year')
      .eq('user_id', this.supabaseProvider.user.id)
      .gte('year', startPeriod.year)
      .lte('year', endPeriod.year);

    if (error) throw this.historyFetchError(tagId, error);

    const startIndex = periodIndex(startPeriod);
    const endIndex = periodIndex(endPeriod);
    return ((data ?? []) as HistoryBudgetRow[]).filter((budget) => {
      const index = periodIndex(budget);
      return index >= startIndex && index <= endIndex;
    });
  }

  private toHistoryContributions<K extends 'budget_line' | 'transaction'>(
    rows: Array<Record<K, TaggedAmountRow | null>>,
    relation: K,
    periodsByBudgetId: Map<string, HistoryBudgetRow>,
    dek: Buffer,
  ): TagHistoryContribution[] {
    const contributions: TagHistoryContribution[] = [];
    for (const row of rows) {
      const amountRow = row[relation];
      const period = amountRow
        ? periodsByBudgetId.get(amountRow.budget_id)
        : undefined;
      if (!amountRow || !period || amountRow.kind !== 'expense') continue;
      contributions.push({
        month: period.month,
        year: period.year,
        amount: this.encryption.decryptAmount(amountRow.amount, dek),
      });
    }
    return contributions;
  }

  private historyFetchError(id: string, error: unknown): BusinessException {
    return new BusinessException(
      ERROR_DEFINITIONS.TAG_FETCH_FAILED,
      undefined,
      {
        operation: 'getTagHistory',
        entityId: id,
        entityType: 'tag',
        supabaseError: error,
      },
      { cause: error },
    );
  }

  private toEntity(row: TagRow): Tag {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
