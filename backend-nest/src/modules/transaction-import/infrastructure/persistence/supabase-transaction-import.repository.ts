import { Inject, Injectable } from '@nestjs/common';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { fetchRowsByParentIds } from '@common/utils/postgrest-pagination';
import { AuthenticatedSupabaseProvider } from '@modules/supabase/authenticated-supabase.provider';
import {
  ENCRYPTION_PORT,
  type EncryptionPort,
} from '@modules/encryption/encryption.tokens';
import type { Database } from '../../../../types/database.types';
import type { TransactionImportRepositoryPort } from '../../domain/ports/transaction-import-repository.port';
import type {
  ImportCandidate,
  ImportTargetBudget,
} from '../../domain/transaction-import.entity';
import { toTransactionDate } from '../../domain/transaction-import.formulas';

type TransactionInsert = Database['public']['Tables']['transaction']['Insert'];

const UNIQUE_VIOLATION = '23505';

@Injectable()
export class SupabaseTransactionImportRepository implements TransactionImportRepositoryPort {
  constructor(
    private readonly supabaseProvider: AuthenticatedSupabaseProvider,
    @Inject(ENCRYPTION_PORT) private readonly encryption: EncryptionPort,
  ) {}

  async findTargetBudget(budgetId: string): Promise<ImportTargetBudget> {
    const user = this.supabaseProvider.user;
    const { data, error } = await this.supabaseProvider.client
      .from('monthly_budget')
      .select('id, month, year')
      .eq('id', budgetId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error || !data) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_NOT_FOUND,
        { id: budgetId },
        {
          operation: 'transactionImport.findTargetBudget',
          userId: user.id,
          entityId: budgetId,
          entityType: 'budget',
          supabaseError: error,
        },
        { cause: error ?? undefined },
      );
    }
    return data;
  }

  fingerprint(materials: readonly string[]): string[] {
    return this.encryption.fingerprints(
      this.supabaseProvider.user.id,
      materials,
    );
  }

  async findImportedFingerprints(
    fingerprints: readonly string[],
  ): Promise<ReadonlySet<string>> {
    if (fingerprints.length === 0) return new Set();
    const supabase = this.supabaseProvider.client;

    try {
      // RLS scopes the read to the caller's Réels; fingerprints are per-user
      // anyway, so another account's row could never match.
      const rows = await fetchRowsByParentIds(
        [...new Set(fingerprints)],
        (chunk, from, to) =>
          supabase
            .from('transaction')
            .select('id, import_fingerprint')
            .in('import_fingerprint', chunk)
            .order('id', { ascending: true })
            .range(from, to),
      );
      return new Set(
        rows
          .map((row) => row.import_fingerprint)
          .filter((value): value is string => value !== null),
      );
    } catch (cause) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_FETCH_FAILED,
        undefined,
        {
          operation: 'transactionImport.findImportedFingerprints',
          userId: this.supabaseProvider.user.id,
        },
        { cause },
      );
    }
  }

  async insertAll(
    budgetId: string,
    candidates: readonly ImportCandidate[],
  ): Promise<void> {
    if (candidates.length === 0) return;
    const user = this.supabaseProvider.user;

    const encrypted = await this.encryption.prepareAmountsData(
      candidates.map((candidate) => candidate.amount),
      user.id,
      user.clientKey,
    );
    const rows: TransactionInsert[] = candidates.map((candidate, index) => ({
      budget_id: budgetId,
      budget_line_id: null,
      name: candidate.name,
      amount: encrypted[index].amount,
      kind: candidate.kind,
      transaction_date: toTransactionDate(candidate.date),
      checked_at: null,
      import_fingerprint: candidate.fingerprint,
    }));

    // One PostgREST request is one INSERT statement: every row lands, or the
    // statement fails and none does.
    const { error } = await this.supabaseProvider.client
      .from('transaction')
      .insert(rows);

    if (!error) return;

    const loggingContext = {
      operation: 'transactionImport.insertAll',
      userId: user.id,
      entityId: budgetId,
      entityType: 'budget',
      rowCount: rows.length,
      supabaseError: error,
    };
    if (error.code === UNIQUE_VIOLATION) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_IMPORT_CONFLICT,
        undefined,
        loggingContext,
        { cause: error },
      );
    }
    throw new BusinessException(
      ERROR_DEFINITIONS.TRANSACTION_IMPORT_FAILED,
      undefined,
      loggingContext,
      { cause: error },
    );
  }
}
