import { describe, expect, it } from 'bun:test';
import { HttpStatus } from '@nestjs/common';
import { BusinessException } from '@common/exceptions/business.exception';
import {
  accountIdForCreate,
  assetIdPatchForKind,
  throwIfAccountLinkRefused,
  throwIfAssetLinkRefused,
} from './asset-link';

const ASSET = '8a0f6c80-1234-4e5f-89ab-444444444444';

describe('accountIdForCreate (CA32 priority, CA45)', () => {
  const COMPTE = 'compte-courant';
  const LIVRET = 'livret';
  const defaultIs = (id: string | null) => async () => id;
  const noRead = async (): Promise<string | null> => {
    throw new Error('the default must not be read');
  };

  it('applies the default when the client sends no account', async () => {
    expect(await accountIdForCreate(undefined, null, defaultIs(COMPTE))).toBe(
      COMPTE,
    );
  });

  it('keeps an explicit null without account (CA32, CA44)', async () => {
    expect(await accountIdForCreate(null, null, noRead)).toBeNull();
  });

  it('lets a chosen account win over the default', async () => {
    expect(await accountIdForCreate(LIVRET, undefined, noRead)).toBe(LIVRET);
  });

  it('gives no account without a default', async () => {
    expect(
      await accountIdForCreate(undefined, undefined, defaultIs(null)),
    ).toBeNull();
  });

  it('skips the default when it is the asset the line feeds (CA45)', async () => {
    expect(
      await accountIdForCreate(undefined, LIVRET, defaultIs(LIVRET)),
    ).toBeNull();
  });
});

describe('assetIdPatchForKind (update path)', () => {
  it('keeps the link (undefined) when neither kind nor asset is sent', () => {
    expect(assetIdPatchForKind(undefined, 'saving', undefined)).toBeUndefined();
  });

  it('keeps the link when the current kind is sent again', () => {
    expect(
      assetIdPatchForKind('expense', 'expense', undefined),
    ).toBeUndefined();
  });

  it('clears the link on a kind change without a new asset', () => {
    expect(assetIdPatchForKind('expense', 'saving', undefined)).toBeNull();
    expect(assetIdPatchForKind('income', 'expense', undefined)).toBeNull();
  });

  it('passes an explicit asset through, with or without a kind change', () => {
    expect(assetIdPatchForKind(undefined, 'saving', ASSET)).toBe(ASSET);
    expect(assetIdPatchForKind('expense', 'saving', ASSET)).toBe(ASSET);
  });

  it('passes an explicit null untag through', () => {
    expect(assetIdPatchForKind(undefined, 'saving', null)).toBeNull();
  });
});

describe('throwIfAssetLinkRefused (trigger rejection mapping)', () => {
  const catchRefusal = (error: unknown): BusinessException => {
    try {
      throwIfAssetLinkRefused(error, { operation: 'test' });
    } catch (thrown) {
      return thrown as BusinessException;
    }
    throw new Error('expected a refusal');
  };

  it('maps a missing or foreign asset to 404 ERR_ASSET_NOT_FOUND', () => {
    const refusal = catchRefusal({
      code: 'P0001',
      message: 'Asset access denied',
    });
    expect(refusal.getStatus()).toBe(HttpStatus.NOT_FOUND);
    expect(refusal.code).toBe('ERR_ASSET_NOT_FOUND');
  });

  it('maps a kind↔direction mismatch to 400', () => {
    const refusal = catchRefusal({
      code: 'P0001',
      message: 'Asset direction does not match the line kind',
    });
    expect(refusal.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    expect(refusal.code).toBe('ERR_BUSINESS_RULE_VIOLATION');
  });

  it('lets other errors fall through to the caller', () => {
    for (const error of [
      null,
      undefined,
      { code: 'P0001', message: 'Budget access denied' },
      { code: '23503', message: 'Asset access denied' },
    ]) {
      expect(() => throwIfAssetLinkRefused(error, {})).not.toThrow();
    }
  });
});

describe('throwIfAccountLinkRefused (account link refusals)', () => {
  const catchRefusal = (error: unknown): BusinessException => {
    try {
      throwIfAccountLinkRefused(error, { operation: 'test' });
    } catch (thrown) {
      return thrown as BusinessException;
    }
    throw new Error('expected a refusal');
  };

  it('maps a missing or foreign account to 404 ERR_ASSET_NOT_FOUND', () => {
    const refusal = catchRefusal({
      code: 'P0001',
      message: 'Account access denied',
    });
    expect(refusal.getStatus()).toBe(HttpStatus.NOT_FOUND);
    expect(refusal.code).toBe('ERR_ASSET_NOT_FOUND');
  });

  it('maps the same asset as account and link to 400 (CA25)', () => {
    const refusal = catchRefusal({
      code: '23514',
      message:
        'new row for relation "budget_line" violates check constraint "budget_line_account_not_asset"',
    });
    expect(refusal.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    expect(refusal.code).toBe('ERR_BUSINESS_RULE_VIOLATION');
    expect(refusal.message).toContain('account cannot be the asset');
  });

  it('is applied by the asset-link mapping too', () => {
    expect(() =>
      throwIfAssetLinkRefused(
        { code: 'P0001', message: 'Account access denied' },
        {},
      ),
    ).toThrow(BusinessException);
  });

  it('lets other errors fall through', () => {
    for (const error of [
      null,
      { code: '23514', message: 'violates check constraint "other_check"' },
      { code: 'P0001', message: 'Asset access denied' },
    ]) {
      expect(() => throwIfAccountLinkRefused(error, {})).not.toThrow();
    }
  });
});
