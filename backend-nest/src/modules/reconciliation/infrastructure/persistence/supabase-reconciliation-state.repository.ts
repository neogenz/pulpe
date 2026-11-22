import { Injectable } from '@nestjs/common';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { AuthenticatedSupabaseProvider } from '@modules/supabase/authenticated-supabase.provider';
import type { ReconciliationStateRepositoryPort } from '../../domain/ports/reconciliation-state-repository.port';
import type {
  ReconciliationStatePatch,
  StoredReconciliationState,
} from '../../domain/reconciliation-state.entity';
import type { Database } from '../../../../types/database.types';

type ReconciliationInsert =
  Database['public']['Tables']['user_reconciliation']['Insert'];

@Injectable()
export class SupabaseReconciliationStateRepository implements ReconciliationStateRepositoryPort {
  constructor(
    private readonly supabaseProvider: AuthenticatedSupabaseProvider,
  ) {}

  async upsert(
    patch: ReconciliationStatePatch,
  ): Promise<StoredReconciliationState> {
    // starting_amount is never written: money from before Pulpe is gone.
    const row: ReconciliationInsert = {
      user_id: this.supabaseProvider.user.id,
    };
    if (patch.lastCompletedAt !== undefined) {
      row.last_completed_at = patch.lastCompletedAt;
    }

    const { data, error } = await this.supabaseProvider.client
      .from('user_reconciliation')
      .upsert(row, { onConflict: 'user_id' })
      .select('last_completed_at')
      .single();

    if (error) throw this.failed('upsertReconciliationState', error);
    return { lastCompletedAt: data.last_completed_at };
  }

  private failed(operation: string, error: unknown): BusinessException {
    return new BusinessException(
      ERROR_DEFINITIONS.RECONCILIATION_UPDATE_FAILED,
      undefined,
      { operation, userId: this.supabaseProvider.user.id },
      { cause: error },
    );
  }
}
