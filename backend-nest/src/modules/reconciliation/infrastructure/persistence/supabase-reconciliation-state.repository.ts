import { Inject, Injectable } from '@nestjs/common';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { AuthenticatedSupabaseProvider } from '@modules/supabase/authenticated-supabase.provider';
import {
  ENCRYPTION_PORT,
  type EncryptionPort,
} from '@modules/encryption/encryption.tokens';
import type { ReconciliationStateRepositoryPort } from '../../domain/ports/reconciliation-state-repository.port';
import type {
  ReconciliationState,
  ReconciliationStatePatch,
} from '../../domain/reconciliation-state.entity';
import type { Database } from '../../../../types/database.types';

type ReconciliationRow =
  Database['public']['Tables']['user_reconciliation']['Row'];
type ReconciliationInsert =
  Database['public']['Tables']['user_reconciliation']['Insert'];

@Injectable()
export class SupabaseReconciliationStateRepository implements ReconciliationStateRepositoryPort {
  constructor(
    private readonly supabaseProvider: AuthenticatedSupabaseProvider,
    @Inject(ENCRYPTION_PORT) private readonly encryption: EncryptionPort,
  ) {}

  async budgetExists(budgetId: string): Promise<boolean> {
    const { data, error } = await this.supabaseProvider.client
      .from('monthly_budget')
      .select('id')
      .eq('id', budgetId)
      .eq('user_id', this.supabaseProvider.user.id)
      .maybeSingle();

    if (error) throw this.failed('FETCH', 'budgetExists', error);
    return data !== null;
  }

  async get(): Promise<ReconciliationState> {
    const { data, error } = await this.supabaseProvider.client
      .from('user_reconciliation')
      .select('*')
      .eq('user_id', this.supabaseProvider.user.id)
      .maybeSingle();

    if (error) throw this.failed('FETCH', 'getReconciliationState', error);
    return await this.toState(data);
  }

  async upsert(patch: ReconciliationStatePatch): Promise<ReconciliationState> {
    const user = this.supabaseProvider.user;
    const row: ReconciliationInsert = { user_id: user.id };
    if (patch.startingAmount !== undefined) {
      row.starting_amount = this.encryption.encryptAmount(
        patch.startingAmount,
        await this.encryption.getDekFor(user),
      );
    }
    if (patch.lastCompletedAt !== undefined) {
      row.last_completed_at = patch.lastCompletedAt;
    }

    const { data, error } = await this.supabaseProvider.client
      .from('user_reconciliation')
      .upsert(row, { onConflict: 'user_id' })
      .select('*')
      .single();

    if (error) throw this.failed('UPDATE', 'upsertReconciliationState', error);
    return await this.toState(data);
  }

  private async toState(
    row: ReconciliationRow | null,
  ): Promise<ReconciliationState> {
    const dek = row?.starting_amount
      ? await this.encryption.getDekFor(this.supabaseProvider.user)
      : null;
    return {
      startingAmount:
        row?.starting_amount && dek
          ? this.encryption.decryptAmount(row.starting_amount, dek)
          : 0,
      lastCompletedAt: row?.last_completed_at ?? null,
    };
  }

  private failed(
    kind: 'FETCH' | 'UPDATE',
    operation: string,
    error: unknown,
  ): BusinessException {
    return new BusinessException(
      ERROR_DEFINITIONS[`RECONCILIATION_${kind}_FAILED`],
      undefined,
      { operation, userId: this.supabaseProvider.user.id },
      { cause: error },
    );
  }
}
