import { Inject, Injectable } from '@nestjs/common';
import type { Buffer } from 'node:buffer';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { AuthenticatedSupabaseProvider } from '@modules/supabase/authenticated-supabase.provider';
import {
  ENCRYPTION_PORT,
  type EncryptionPort,
} from '@modules/encryption/encryption.tokens';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import { mapCurrencyNonAmountMetadataToDb } from '@common/utils/currency-metadata.mapper';
import {
  fetchTagIds,
  replaceTagLinks as replaceTagLinksWithRpc,
  updateTaggedEntity,
} from '@common/utils/tag-links.util';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type {
  TransactionRepositoryPort,
  TransactionSearchCriteria,
} from '../../domain/ports/transaction-repository.port';
import type {
  Transaction,
  TransactionCreateInput,
  TransactionUpdatePatch,
  TransactionInsert,
  TransactionRow,
  TransactionUpdate,
  BudgetLineForAllocation,
  SpreadSourceTransaction,
  TransactionSearchTransactionRow,
  TransactionSearchBudgetLineRow,
} from '../../domain/transaction.entity';
import type { Database } from '../../../../types/database.types';

type TransactionKind = Database['public']['Enums']['transaction_kind'];

/** Embed junction rows so every read maps to Transaction.tagIds in one query. */
const TRANSACTION_WITH_TAGS_SELECT = '*, transaction_tag(tag_id)';

const SEARCH_TRANSACTION_FIELDS = `
  id,
  name,
  amount,
  kind,
  transaction_date,
  budget_id,
  budget:budget_id (
    description,
    month,
    year
  )
`;

type TransactionRowWithTags = TransactionRow & {
  transaction_tag?: { tag_id: string }[];
};

interface TransactionTagSearchOptions {
  userId: string;
  searchPattern?: string | null;
  textTagIds?: string[];
}

@Injectable()
export class SupabaseTransactionRepository implements TransactionRepositoryPort {
  constructor(
    private readonly supabaseProvider: AuthenticatedSupabaseProvider,
    @Inject(ENCRYPTION_PORT) private readonly encryption: EncryptionPort,
    @InjectInfoLogger(SupabaseTransactionRepository.name)
    private readonly logger: InfoLogger,
  ) {}

  async findAll(): Promise<Transaction[]> {
    const supabase = this.supabaseProvider.client;
    const { data, error } = await supabase
      .from('transaction')
      .select(TRANSACTION_WITH_TAGS_SELECT)
      .order('created_at', { ascending: false });

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_FETCH_FAILED,
        undefined,
        {
          operation: 'listTransactions',
          entityType: 'transaction',
          supabaseError: error,
        },
        { cause: error },
      );
    }

    if (!data?.length) return [];
    const dek = await this.encryption.getDekFor(this.supabaseProvider.user);
    return data.map((row) => this.toEntity(row, dek));
  }

  async findById(id: string): Promise<Transaction> {
    const supabase = this.supabaseProvider.client;
    const { data, error } = await supabase
      .from('transaction')
      .select(TRANSACTION_WITH_TAGS_SELECT)
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_NOT_FOUND,
        { id },
        {
          operation: 'getTransaction',
          entityId: id,
          entityType: 'transaction',
          supabaseError: error,
        },
      );
    }

    const dek = await this.encryption.getDekFor(this.supabaseProvider.user);
    return this.toEntity(data, dek);
  }

  async findSpreadSource(id: string): Promise<SpreadSourceTransaction> {
    const supabase = this.supabaseProvider.client;
    const { data, error } = await supabase
      .from('transaction')
      .select('*, monthly_budget!inner(month, year, user_id)')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_NOT_FOUND,
        { id },
        {
          operation: 'findSpreadSource',
          entityId: id,
          entityType: 'transaction',
          supabaseError: error,
        },
        { cause: error ?? undefined },
      );
    }

    const dek = await this.encryption.getDekFor(this.supabaseProvider.user);
    const row = data as TransactionRow & {
      monthly_budget: { month: number; year: number; user_id: string };
    };
    const decrypted = this.encryption.decryptRowAmountFields(row, dek);
    return {
      id: decrypted.id,
      budgetId: decrypted.budget_id,
      userId: row.monthly_budget.user_id,
      budgetLineId: decrypted.budget_line_id,
      month: row.monthly_budget.month,
      year: row.monthly_budget.year,
      name: decrypted.name,
      amount: decrypted.amount,
      originalAmount: decrypted.original_amount,
      originalCurrency:
        decrypted.original_currency as SpreadSourceTransaction['originalCurrency'],
      targetCurrency:
        decrypted.target_currency as SpreadSourceTransaction['targetCurrency'],
      exchangeRate: decrypted.exchange_rate,
      kind: decrypted.kind,
    };
  }

  async findByBudgetId(budgetId: string): Promise<Transaction[]> {
    const supabase = this.supabaseProvider.client;
    const { data, error } = await supabase
      .from('transaction')
      .select(TRANSACTION_WITH_TAGS_SELECT)
      .eq('budget_id', budgetId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_FETCH_FAILED,
        undefined,
        {
          operation: 'listTransactionsByBudget',
          entityId: budgetId,
          entityType: 'budget',
          supabaseError: error,
        },
        { cause: error },
      );
    }

    if (!data?.length) return [];
    const dek = await this.encryption.getDekFor(this.supabaseProvider.user);
    return data.map((row) => this.toEntity(row, dek));
  }

  async findByBudgetLineId(budgetLineId: string): Promise<Transaction[]> {
    const supabase = this.supabaseProvider.client;
    const { data, error } = await supabase
      .from('transaction')
      .select(TRANSACTION_WITH_TAGS_SELECT)
      .eq('budget_line_id', budgetLineId)
      .order('transaction_date', { ascending: false });

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_FETCH_FAILED,
        undefined,
        {
          operation: 'listTransactionsByBudgetLine',
          entityId: budgetLineId,
          entityType: 'budget_line',
          supabaseError: error,
        },
        { cause: error },
      );
    }

    if (!data?.length) return [];
    const dek = await this.encryption.getDekFor(this.supabaseProvider.user);
    return data.map((row) => this.toEntity(row, dek));
  }

  async insert(input: TransactionCreateInput): Promise<Transaction> {
    const supabase = this.supabaseProvider.client;
    const user = this.supabaseProvider.user;

    const insertRow = await this.toInsertRow(input, user);

    const { data: row, error } = await supabase
      .from('transaction')
      .insert(insertRow)
      .select(TRANSACTION_WITH_TAGS_SELECT)
      .single();

    if (error || !row) {
      const loggingContext = {
        operation: 'createTransaction',
        entityType: 'transaction',
        supabaseError: error,
      };

      if (error?.code === '23505') {
        throw new BusinessException(
          ERROR_DEFINITIONS.TRANSACTION_ALREADY_EXISTS,
          { id: input.id },
          loggingContext,
          { cause: error },
        );
      }

      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_CREATE_FAILED,
        undefined,
        loggingContext,
        { cause: error ?? undefined },
      );
    }

    if (input.tagIds?.length) {
      try {
        await this.replaceTagLinks(row.id, input.tagIds, 'createTransaction');
      } catch (linkError) {
        // Compensation: keep create atomic from the client's perspective —
        // a transaction without its requested tags must not survive a failed link.
        const { error: cleanupError } = await supabase
          .from('transaction')
          .delete()
          .eq('id', row.id);
        if (cleanupError) {
          this.logger.warn(
            {
              operation: 'createTransaction.compensateTagFailure',
              entityId: row.id,
              err: cleanupError,
            },
            'Failed to delete transaction after tag linking failure',
          );
        }
        throw linkError;
      }
    }

    const dek = await this.encryption.getDekFor(this.supabaseProvider.user);
    return {
      ...this.toEntity(row, dek),
      tagIds: input.tagIds ?? [],
    };
  }

  async update(
    id: string,
    patch: TransactionUpdatePatch,
  ): Promise<Transaction> {
    const supabase = this.supabaseProvider.client;
    const user = this.supabaseProvider.user;
    const updateRow = await this.toUpdateRow(patch, user);

    if (patch.tagIds !== undefined) {
      const row = await updateTaggedEntity<TransactionRow>(supabase, {
        rpcName: 'update_transaction_with_tags',
        entityId: id,
        patch: updateRow,
        tagIds: patch.tagIds,
        operation: 'updateTransaction',
        entityType: 'transaction',
        parentNotFoundMessage: 'Transaction not found',
        notFoundErrorDef: ERROR_DEFINITIONS.TRANSACTION_NOT_FOUND,
        fallbackErrorDef: ERROR_DEFINITIONS.TRANSACTION_UPDATE_FAILED,
      });
      const dek = await this.encryption.getDekFor(user);
      return { ...this.toEntity(row, dek), tagIds: patch.tagIds };
    }

    const query = Object.keys(updateRow).length
      ? supabase
          .from('transaction')
          .update(updateRow)
          .eq('id', id)
          .select(TRANSACTION_WITH_TAGS_SELECT)
          .single()
      : supabase
          .from('transaction')
          .select(TRANSACTION_WITH_TAGS_SELECT)
          .eq('id', id)
          .single();

    const { data: row, error } = await query;

    if (error || !row) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_NOT_FOUND,
        { id },
        {
          operation: 'updateTransaction',
          entityId: id,
          entityType: 'transaction',
          supabaseError: error,
        },
        { cause: error ?? undefined },
      );
    }

    const dek = await this.encryption.getDekFor(user);
    return this.toEntity(row, dek);
  }

  /**
   * Replace-set semantics: the provided tagIds become the transaction's exact
   * tag set. The RPC runs delete + insert in one DB transaction, so a failed
   * insert (deleted or foreign tag id) rolls back the delete and existing
   * links survive. RLS on transaction_tag guards both directions (own
   * transaction, own tag) — a foreign/unknown tag id surfaces as TAG_NOT_FOUND.
   */
  private async replaceTagLinks(
    transactionId: string,
    tagIds: string[],
    operation: string,
  ): Promise<void> {
    await replaceTagLinksWithRpc(this.supabaseProvider.client, {
      rpcName: 'replace_transaction_tags',
      entityId: transactionId,
      tagIds,
      operation,
      entityType: 'transaction_tag',
      userId: this.supabaseProvider.user.id,
      fallbackErrorDef: ERROR_DEFINITIONS.TRANSACTION_UPDATE_FAILED,
    });
  }

  async postpone(
    id: string,
    sourceBudgetId: string,
    targetBudgetId: string,
    shiftedDate: string,
  ): Promise<Transaction> {
    const supabase = this.supabaseProvider.client;
    const { data: row, error } = await supabase
      .from('transaction')
      .update({
        budget_id: targetBudgetId,
        transaction_date: shiftedDate,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('budget_id', sourceBudgetId)
      .is('budget_line_id', null)
      .is('checked_at', null)
      .select(TRANSACTION_WITH_TAGS_SELECT)
      .single();

    if (error || !row) {
      throw new BusinessException(
        ERROR_DEFINITIONS.CONCURRENT_MODIFICATION,
        { resource: 'transaction' },
        {
          operation: 'postponeTransaction',
          entityId: id,
          entityType: 'transaction',
          supabaseError: error,
        },
        { cause: error ?? undefined },
      );
    }

    const dek = await this.encryption.getDekFor(this.supabaseProvider.user);
    return this.toEntity(row, dek);
  }

  async delete(id: string): Promise<void> {
    const supabase = this.supabaseProvider.client;
    const { error } = await supabase.from('transaction').delete().eq('id', id);

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_NOT_FOUND,
        { id },
        {
          operation: 'deleteTransaction',
          entityId: id,
          entityType: 'transaction',
          supabaseError: error,
        },
      );
    }
  }

  async toggleCheck(id: string): Promise<Transaction> {
    const supabase = this.supabaseProvider.client;
    const { data, error } = await supabase
      .rpc('toggle_transaction_check', {
        p_transaction_id: id,
      })
      .single();

    if (error || !data) {
      // RPC raises 'Transaction not found or access denied' (SQLSTATE P0001)
      // when the row does not exist or RLS denies access. Map it to 404 instead
      // of the generic 500, so clients can distinguish missing/forbidden from
      // genuine update failures.
      const isNotFoundOrForbidden = error?.message?.includes(
        'Transaction not found or access denied',
      );
      if (isNotFoundOrForbidden) {
        throw new BusinessException(
          ERROR_DEFINITIONS.TRANSACTION_NOT_FOUND,
          { id },
          {
            operation: 'toggleCheck',
            entityId: id,
            entityType: 'transaction',
          },
          { cause: error },
        );
      }
      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_UPDATE_FAILED,
        undefined,
        {
          operation: 'toggleCheck',
          entityId: id,
          entityType: 'transaction',
          supabaseError: error,
        },
        { cause: error ?? undefined },
      );
    }

    const tagIds = await fetchTagIds(
      supabase,
      {
        junctionTable: 'transaction_tag',
        fkColumn: 'transaction_id',
      },
      id,
      'toggleCheck',
      ERROR_DEFINITIONS.TRANSACTION_UPDATE_FAILED,
    );

    const dek = await this.encryption.getDekFor(this.supabaseProvider.user);
    return {
      ...this.toEntity(data, dek),
      tagIds,
    };
  }

  async fetchBudgetIdForTransaction(id: string): Promise<string | null> {
    const supabase = this.supabaseProvider.client;
    const { data, error } = await supabase
      .from('transaction')
      .select('budget_id')
      .eq('id', id)
      .single();

    if (error) {
      // PGRST116 = "Searched for a single row but found 0 rows"
      if (error.code === 'PGRST116') return null;
      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_FETCH_FAILED,
        undefined,
        {
          operation: 'fetchBudgetIdForTransaction',
          entityId: id,
          entityType: 'transaction',
          supabaseError: error,
        },
        { cause: error },
      );
    }

    return data?.budget_id ?? null;
  }

  async fetchBudgetLineForAllocation(
    budgetLineId: string,
  ): Promise<BudgetLineForAllocation | null> {
    const supabase = this.supabaseProvider.client;
    const { data, error } = await supabase
      .from('budget_line')
      .select('id, budget_id, kind')
      .eq('id', budgetLineId)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      budgetId: data.budget_id,
      kind: data.kind,
    };
  }

  async assertBudgetLineExists(budgetLineId: string): Promise<void> {
    const supabase = this.supabaseProvider.client;
    const { data, error } = await supabase
      .from('budget_line')
      .select('id')
      .eq('id', budgetLineId)
      .single();

    if (error || !data) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_LINE_NOT_FOUND,
        { id: budgetLineId },
        {
          operation: 'assertBudgetLineExists',
          entityId: budgetLineId,
          entityType: 'budget_line',
          supabaseError: error,
        },
      );
    }
  }

  async fetchBudgetIdsByYears(
    userId: string,
    years: number[],
  ): Promise<string[]> {
    const supabase = this.supabaseProvider.client;
    const { data, error } = await supabase
      .from('monthly_budget')
      .select('id')
      .eq('user_id', userId)
      .in('year', years);

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_FETCH_FAILED,
        undefined,
        {
          operation: 'fetchBudgetIdsByYears',
          entityType: 'monthly_budget',
          supabaseError: error,
        },
        { cause: error },
      );
    }

    return data?.map((b) => b.id) ?? [];
  }

  async fetchTransactionsByPattern(
    criteria: TransactionSearchCriteria,
  ): Promise<TransactionSearchTransactionRow[]> {
    const matches = await this.queryTransactionMatches(criteria);
    const data = [...new Map(matches.map((row) => [row.id, row])).values()]
      .sort(
        (a, b) =>
          new Date(b.transaction_date).getTime() -
          new Date(a.transaction_date).getTime(),
      )
      .slice(0, 25);

    if (!data.length) return [];
    const dek = await this.encryption.getDekFor(this.supabaseProvider.user);
    return data.map((row) => this.toSearchTransactionRow(row, dek));
  }

  async fetchBudgetLinesByPattern(
    criteria: TransactionSearchCriteria,
  ): Promise<TransactionSearchBudgetLineRow[]> {
    const data = criteria.tagIds.length
      ? await this.queryBudgetLinesByTagIds(
          criteria.tagIds,
          criteria.budgetIds,
          criteria.searchPattern,
        )
      : criteria.searchPattern
        ? await this.queryBudgetLinesByPattern(
            criteria.searchPattern,
            criteria.budgetIds,
          )
        : [];

    if (!data.length) return [];
    const dek = await this.encryption.getDekFor(this.supabaseProvider.user);
    return data.map((row) => this.toSearchBudgetLineRow(row, dek));
  }

  private async queryTransactionMatches(
    criteria: TransactionSearchCriteria,
  ): Promise<RawSearchTransactionRow[]> {
    if (!criteria.tagIds.length) {
      return criteria.searchPattern
        ? this.queryTransactionsByText(
            criteria.searchPattern,
            criteria.userId,
            criteria.budgetIds,
          )
        : [];
    }
    if (!criteria.searchPattern) {
      return this.queryTransactionsByTagIds(
        criteria.tagIds,
        criteria.budgetIds,
        { userId: criteria.userId },
      );
    }
    return this.queryTransactionsByTagsAndText(
      criteria.tagIds,
      criteria.searchPattern,
      criteria.userId,
      criteria.budgetIds,
    );
  }

  private async queryTransactionsByTagsAndText(
    tagIds: string[],
    searchPattern: string,
    userId: string,
    budgetIds: string[] | null,
  ): Promise<RawSearchTransactionRow[]> {
    const [nameMatches, textTagIds] = await Promise.all([
      this.queryTransactionsByTagIds(tagIds, budgetIds, {
        userId,
        searchPattern,
      }),
      this.queryTagIdsByName(searchPattern, userId),
    ]);
    if (!textTagIds.length) return nameMatches;

    const tagNameMatches = await this.queryTransactionsByTagIds(
      tagIds,
      budgetIds,
      { userId, textTagIds },
    );
    return [...nameMatches, ...tagNameMatches];
  }

  private async queryTransactionsByText(
    searchPattern: string,
    userId: string,
    budgetIds: string[] | null,
  ): Promise<RawSearchTransactionRow[]> {
    const [nameMatches, matchingTagIds] = await Promise.all([
      this.queryTransactionsByName(searchPattern, budgetIds),
      this.queryTagIdsByName(searchPattern, userId),
    ]);
    const tagMatches = matchingTagIds.length
      ? await this.queryTransactionsByTagIds(matchingTagIds, budgetIds, {
          userId,
        })
      : [];
    return [
      ...new Map(
        [...nameMatches, ...tagMatches].map((row) => [row.id, row]),
      ).values(),
    ];
  }

  private async queryTransactionsByName(
    searchPattern: string,
    budgetIds: string[] | null,
  ): Promise<RawSearchTransactionRow[]> {
    const supabase = this.supabaseProvider.client;
    let query = supabase
      .from('transaction')
      .select(SEARCH_TRANSACTION_FIELDS)
      .ilike('name', searchPattern);

    if (budgetIds) {
      query = query.in('budget_id', budgetIds);
    }

    const { data, error } = await query
      .order('transaction_date', { ascending: false })
      .limit(25)
      .overrideTypes<RawSearchTransactionRow[], { merge: false }>();

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_FETCH_FAILED,
        undefined,
        {
          operation: 'fetchTransactionsByPattern',
          entityType: 'transaction',
          supabaseError: error,
        },
        { cause: error },
      );
    }

    return data ?? [];
  }

  private async queryTagIdsByName(
    searchPattern: string,
    userId: string,
  ): Promise<string[]> {
    const { data, error } = await this.supabaseProvider.client
      .from('tag')
      .select('id')
      .eq('user_id', userId)
      .ilike('name', searchPattern);

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_FETCH_FAILED,
        undefined,
        {
          operation: 'fetchTransactionTagMatches',
          userId,
          entityType: 'tag',
          supabaseError: error,
        },
        { cause: error },
      );
    }

    return data?.map(({ id }) => id) ?? [];
  }

  private async queryTransactionsByTagIds(
    tagIds: string[],
    budgetIds: string[] | null,
    options: TransactionTagSearchOptions,
  ): Promise<RawSearchTransactionRow[]> {
    const hasTextTagFilter = Boolean(options.textTagIds?.length);
    const tagRelations = hasTextTagFilter
      ? `
        selected_tags:transaction_tag!inner(tag_id),
        text_tags:transaction_tag!inner(tag_id)
      `
      : 'transaction_tag!inner(tag_id)';
    const selectedTagsRelation = hasTextTagFilter
      ? 'selected_tags'
      : 'transaction_tag';
    const select: string = `${SEARCH_TRANSACTION_FIELDS}, ${tagRelations}`;
    let query = this.supabaseProvider.client
      .from('transaction')
      .select(select)
      .in(`${selectedTagsRelation}.tag_id`, tagIds);
    if (options.textTagIds?.length) {
      query = query.in('text_tags.tag_id', options.textTagIds);
    }
    if (options.searchPattern) {
      query = query.ilike('name', options.searchPattern);
    }
    if (budgetIds) {
      query = query.in('budget_id', budgetIds);
    }

    const { data, error } = await query
      .order('transaction_date', { ascending: false })
      .limit(25)
      .overrideTypes<RawSearchTransactionRow[], { merge: false }>();
    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_FETCH_FAILED,
        undefined,
        {
          operation: 'fetchTransactionsByTagIds',
          userId: options.userId,
          entityType: 'transaction',
          supabaseError: error,
        },
        { cause: error },
      );
    }

    return data ?? [];
  }

  private async queryBudgetLinesByPattern(
    searchPattern: string,
    budgetIds: string[] | null,
  ): Promise<RawSearchBudgetLineRow[]> {
    const supabase = this.supabaseProvider.client;
    let query = supabase
      .from('budget_line')
      .select(
        `
        id,
        name,
        amount,
        kind,
        recurrence,
        budget_id,
        budget:budget_id (
          description,
          month,
          year
        )
      `,
      )
      .ilike('name', searchPattern);

    if (budgetIds) {
      query = query.in('budget_id', budgetIds);
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(25);

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_FETCH_FAILED,
        undefined,
        {
          operation: 'fetchBudgetLinesByPattern',
          entityType: 'budget_line',
          supabaseError: error,
        },
        { cause: error },
      );
    }

    return (data ?? []) as RawSearchBudgetLineRow[];
  }

  private async queryBudgetLinesByTagIds(
    tagIds: string[],
    budgetIds: string[] | null,
    searchPattern?: string | null,
  ): Promise<RawSearchBudgetLineRow[]> {
    const supabase = this.supabaseProvider.client;
    let query = supabase
      .from('budget_line')
      .select(
        `
        id,
        name,
        amount,
        kind,
        recurrence,
        budget_id,
        budget:budget_id (
          description,
          month,
          year
        ),
        budget_line_tag!inner(tag_id)
      `,
      )
      .in('budget_line_tag.tag_id', tagIds);
    if (searchPattern) {
      query = query.ilike('name', searchPattern);
    }
    if (budgetIds) {
      query = query.in('budget_id', budgetIds);
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(25);
    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_FETCH_FAILED,
        undefined,
        {
          operation: 'fetchBudgetLinesByTagIds',
          entityType: 'budget_line',
          supabaseError: error,
        },
        { cause: error },
      );
    }

    return (data ?? []) as RawSearchBudgetLineRow[];
  }

  private toEntity(row: TransactionRowWithTags, dek: Buffer): Transaction {
    const decrypted = this.encryption.decryptRowAmountFields(row, dek);
    return {
      id: decrypted.id,
      budgetId: decrypted.budget_id,
      budgetLineId: decrypted.budget_line_id,
      name: decrypted.name,
      amount: decrypted.amount,
      originalAmount: decrypted.original_amount,
      originalCurrency: decrypted.original_currency,
      targetCurrency: decrypted.target_currency,
      exchangeRate: decrypted.exchange_rate,
      kind: decrypted.kind,
      tagIds: (row.transaction_tag ?? []).map((link) => link.tag_id),
      transactionDate: decrypted.transaction_date,
      checkedAt: decrypted.checked_at,
      createdAt: decrypted.created_at,
      updatedAt: decrypted.updated_at,
    };
  }

  private toSearchTransactionRow(
    row: RawSearchTransactionRow,
    dek: Buffer,
  ): TransactionSearchTransactionRow {
    return {
      id: row.id,
      name: row.name,
      amount: row.amount
        ? this.encryption.tryDecryptAmount(row.amount, dek, 0)
        : 0,
      kind: row.kind,
      transactionDate: row.transaction_date,
      budgetId: row.budget_id,
      budget: row.budget as TransactionSearchTransactionRow['budget'],
    };
  }

  private toSearchBudgetLineRow(
    row: RawSearchBudgetLineRow,
    dek: Buffer,
  ): TransactionSearchBudgetLineRow {
    return {
      id: row.id,
      name: row.name,
      amount: row.amount
        ? this.encryption.tryDecryptAmount(row.amount, dek, 0)
        : 0,
      kind: row.kind,
      recurrence: row.recurrence,
      budgetId: row.budget_id,
      budget: row.budget as TransactionSearchBudgetLineRow['budget'],
    };
  }

  private async toInsertRow(
    input: TransactionCreateInput,
    user: AuthenticatedUser,
  ): Promise<TransactionInsert> {
    const { amount: encryptedAmount } = await this.encryption.prepareAmountData(
      input.amount,
      user.id,
      user.clientKey,
    );

    const encryptedOriginalAmount = await this.encryption.encryptOptionalAmount(
      input.originalAmount,
      user.id,
      user.clientKey,
    );

    return {
      ...(input.id ? { id: input.id } : {}),
      budget_id: input.budgetId,
      budget_line_id: input.budgetLineId ?? null,
      name: input.name,
      amount: encryptedAmount,
      original_amount: encryptedOriginalAmount,
      kind: input.kind as TransactionKind,
      transaction_date: input.transactionDate,
      checked_at: input.checkedAt ?? null,
      ...mapCurrencyNonAmountMetadataToDb(
        {
          originalCurrency: input.originalCurrency,
          targetCurrency: input.targetCurrency,
          exchangeRate: input.exchangeRate,
        },
        { userId: user.id },
      ),
    };
  }

  private async toUpdateRow(
    patch: TransactionUpdatePatch,
    user: AuthenticatedUser,
  ): Promise<TransactionUpdate> {
    const updateData: TransactionUpdate = this.buildScalarUpdates(patch);

    if (patch.amount !== undefined) {
      const { amount } = await this.encryption.prepareAmountData(
        patch.amount,
        user.id,
        user.clientKey,
      );
      updateData.amount = amount;
    }

    if (patch.originalAmount !== undefined) {
      updateData.original_amount = await this.encryption.encryptOptionalAmount(
        patch.originalAmount,
        user.id,
        user.clientKey,
      );
    }

    Object.assign(
      updateData,
      mapCurrencyNonAmountMetadataToDb(
        {
          originalCurrency: patch.originalCurrency,
          targetCurrency: patch.targetCurrency,
          exchangeRate: patch.exchangeRate,
        },
        { userId: user.id },
      ),
    );

    if (Object.keys(updateData).length) {
      updateData.updated_at = new Date().toISOString();
    }
    return updateData;
  }

  private buildScalarUpdates(patch: TransactionUpdatePatch): TransactionUpdate {
    const updateData: TransactionUpdate = {};
    if (patch.name !== undefined) updateData.name = patch.name;
    if (patch.kind !== undefined)
      updateData.kind = patch.kind as TransactionKind;
    if (patch.transactionDate !== undefined)
      updateData.transaction_date = patch.transactionDate;
    if (patch.checkedAt !== undefined) updateData.checked_at = patch.checkedAt;
    return updateData;
  }
}

interface RawSearchTransactionRow {
  id: string;
  name: string;
  amount: string | null;
  kind: string;
  transaction_date: string;
  budget_id: string;
  budget: unknown;
}

interface RawSearchBudgetLineRow {
  id: string;
  name: string;
  amount: string | null;
  kind: string;
  recurrence: 'fixed' | 'one_off';
  budget_id: string;
  budget: unknown;
}
