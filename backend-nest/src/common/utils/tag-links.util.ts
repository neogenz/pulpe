import {
  ERROR_DEFINITIONS,
  type ErrorDefinition,
} from '@common/constants/error-definitions';
import { BusinessException } from '@common/exceptions/business.exception';
import { isSavingsGoalLinkDenied } from '@common/utils/savings-goal-link';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import type { Json } from '../../types/database.types';

type TagRpcName =
  | 'replace_transaction_tags'
  | 'replace_budget_line_tags'
  | 'replace_template_line_tags';

type AtomicTaggedUpdateRpcName =
  | 'update_transaction_with_tags'
  | 'update_budget_line_with_tags'
  | 'update_template_line_with_tags';

interface AtomicTaggedUpdateParams {
  rpcName: AtomicTaggedUpdateRpcName;
  entityId: string;
  patch: Json;
  tagIds: string[];
  operation: string;
  entityType: string;
  parentNotFoundMessage: string;
  notFoundErrorDef: ErrorDefinition;
  fallbackErrorDef: ErrorDefinition;
  duplicateErrorDef?: ErrorDefinition;
}

interface AtomicTaggedUpdateError {
  code?: string;
  message?: string;
}

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

async function callAtomicTaggedUpdate(
  supabase: AuthenticatedSupabaseClient,
  params: AtomicTaggedUpdateParams,
): Promise<{ data: unknown; error: AtomicTaggedUpdateError | null }> {
  if (params.rpcName === 'update_transaction_with_tags') {
    return supabase.rpc('update_transaction_with_tags', {
      p_transaction_id: params.entityId,
      p_patch: params.patch,
      p_tag_ids: params.tagIds,
    });
  }
  if (params.rpcName === 'update_budget_line_with_tags') {
    return supabase.rpc('update_budget_line_with_tags', {
      p_budget_line_id: params.entityId,
      p_patch: params.patch,
      p_tag_ids: params.tagIds,
    });
  }
  if (params.rpcName === 'update_template_line_with_tags') {
    return supabase.rpc('update_template_line_with_tags', {
      p_template_line_id: params.entityId,
      p_patch: params.patch,
      p_tag_ids: params.tagIds,
    });
  }
  const unhandledRpcName: never = params.rpcName;
  throw new Error(`Unhandled atomic tagged update RPC: ${unhandledRpcName}`);
}

function throwTaggedBusinessError(
  errorDef: ErrorDefinition,
  details: Record<string, unknown> | undefined,
  params: AtomicTaggedUpdateParams,
  error: AtomicTaggedUpdateError | null,
): never {
  throw new BusinessException(
    errorDef,
    details,
    {
      operation: params.operation,
      entityId: params.entityId,
      entityType: params.entityType,
      supabaseError: error,
    },
    { cause: error ?? undefined },
  );
}

function throwAtomicTaggedUpdateError(
  params: AtomicTaggedUpdateParams,
  error: AtomicTaggedUpdateError | null,
): never {
  const details = { id: params.entityId };
  const isParentNotFound =
    !error ||
    error.code === 'PGRST116' ||
    (error.code === 'P0001' &&
      error.message?.includes(params.parentNotFoundMessage));

  if (isParentNotFound) {
    throwTaggedBusinessError(params.notFoundErrorDef, details, params, error);
  }
  if (error.code === '23503' || error.code === '42501') {
    throwTaggedBusinessError(
      ERROR_DEFINITIONS.TAG_NOT_FOUND,
      undefined,
      params,
      error,
    );
  }
  if (error.code === '23505' && params.duplicateErrorDef) {
    throwTaggedBusinessError(params.duplicateErrorDef, details, params, error);
  }
  if (isSavingsGoalLinkDenied(error)) {
    throwTaggedBusinessError(
      ERROR_DEFINITIONS.SAVINGS_GOAL_NOT_FOUND,
      undefined,
      params,
      error,
    );
  }
  throwTaggedBusinessError(params.fallbackErrorDef, details, params, error);
}

export async function updateTaggedEntity<Row>(
  supabase: AuthenticatedSupabaseClient,
  params: AtomicTaggedUpdateParams,
): Promise<Row> {
  const { data, error } = await callAtomicTaggedUpdate(supabase, params);

  if (!error && data) return data as Row;
  throwAtomicTaggedUpdateError(params, error);
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
