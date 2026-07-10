import {
  ERROR_DEFINITIONS,
  type ErrorDefinition,
} from '@common/constants/error-definitions';
import { BusinessException } from '@common/exceptions/business.exception';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';

type TagRpcName =
  | 'replace_transaction_tags'
  | 'replace_budget_line_tags'
  | 'replace_template_line_tags';

export async function replaceTagLinks(
  supabase: AuthenticatedSupabaseClient,
  params: {
    rpcName: TagRpcName;
    rpcIdParam: string;
    entityId: string;
    tagIds: string[];
    operation: string;
    entityType: string;
    fallbackErrorDef: ErrorDefinition;
  },
): Promise<void> {
  const { error } = await supabase.rpc(params.rpcName, {
    [params.rpcIdParam]: params.entityId,
    p_tag_ids: params.tagIds,
  } as never);

  if (!error) return;

  const loggingContext = {
    operation: params.operation,
    entityId: params.entityId,
    entityType: params.entityType,
    supabaseError: error,
  };
  if (error.code === '23503' || error.code === '42501') {
    throw new BusinessException(
      ERROR_DEFINITIONS.TAG_NOT_FOUND,
      undefined,
      loggingContext,
      { cause: error },
    );
  }

  throw new BusinessException(
    params.fallbackErrorDef,
    { id: params.entityId },
    loggingContext,
    { cause: error },
  );
}

export async function fetchTagIds(
  supabase: AuthenticatedSupabaseClient,
  junctionTable: 'transaction_tag' | 'budget_line_tag',
  fkColumn: 'transaction_id' | 'budget_line_id',
  entityId: string,
  operation: string,
  fallbackErrorDef: ErrorDefinition,
): Promise<string[]> {
  const { data, error } = await supabase
    .from(junctionTable)
    .select('tag_id')
    .eq(fkColumn, entityId);

  if (error) {
    throw new BusinessException(
      fallbackErrorDef,
      undefined,
      {
        operation,
        entityId,
        entityType: junctionTable,
        supabaseError: error,
      },
      { cause: error },
    );
  }

  return ((data ?? []) as { tag_id: string }[]).map((link) => link.tag_id);
}
