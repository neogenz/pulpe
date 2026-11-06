import type { TransactionKind } from 'pulpe-shared';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { BusinessException } from '@common/exceptions/business.exception';

/**
 * Update path — `undefined` = leave the link untouched (iOS and Android never
 * send `assetId`). A kind change without a new asset clears it: the old asset
 * sat on the side the previous kind required (saving and income → own, expense
 * → owe). Sending the line's current kind again is not a change; a current kind
 * the caller could not read counts as one.
 */
export function assetIdPatchForKind(
  kind: TransactionKind | undefined,
  currentKind: TransactionKind | undefined,
  assetId: string | null | undefined,
): string | null | undefined {
  if (assetId !== undefined) return assetId;
  return kind !== undefined && kind !== currentKind ? null : undefined;
}

/**
 * Exact messages RAISEd (P0001) by the `enforce_asset_line_link` trigger
 * (migration 20261103130000): an `asset_id` that isn't an asset of the line's
 * owner (stale picker or foreign asset), then a kind↔direction mismatch.
 */
const ASSET_LINK_DENIED_MESSAGE = 'Asset access denied';
const ASSET_LINK_DIRECTION_MESSAGE =
  'Asset direction does not match the line kind';

function isP0001With(error: unknown, text: string): boolean {
  const { code, message } = (error ?? {}) as {
    code?: string;
    message?: string;
  };
  return code === 'P0001' && Boolean(message?.includes(text));
}

/**
 * Called first by every write path that can carry an `asset_id`. Business
 * rejections, not server faults: a missing or foreign asset is a 404 (RLS-hiding
 * idiom), a wrong direction is a 400. Anything else falls through to the
 * caller's generic failure.
 */
export function throwIfAssetLinkRefused(
  error: unknown,
  loggingContext: Record<string, unknown>,
): void {
  if (isP0001With(error, ASSET_LINK_DENIED_MESSAGE)) {
    throw new BusinessException(
      ERROR_DEFINITIONS.ASSET_NOT_FOUND,
      undefined,
      loggingContext,
      { cause: error ?? undefined },
    );
  }
  if (isP0001With(error, ASSET_LINK_DIRECTION_MESSAGE)) {
    throw new BusinessException(
      ERROR_DEFINITIONS.BUSINESS_RULE_VIOLATION,
      {
        rule: 'an expense links to a debt, an income or a saving to an asset you own',
      },
      loggingContext,
      { cause: error ?? undefined },
    );
  }
}
