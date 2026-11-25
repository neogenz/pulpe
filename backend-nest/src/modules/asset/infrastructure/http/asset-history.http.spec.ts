import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test';
import {
  type CanActivate,
  type ExecutionContext,
  type INestApplication,
  VersioningType,
} from '@nestjs/common';
import { APP_FILTER, APP_PIPE, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { ZodValidationPipe } from 'nestjs-zod';
import { PinoLogger } from 'nestjs-pino';
import { assetHistoryResponseSchema } from 'pulpe-shared';
import { AssetController } from './asset.controller';
import { GetAssetHistoryUseCase } from '../../application/get-asset-history.use-case';
import { GetNetWorthUseCase } from '../../application/get-net-worth.use-case';
import { CreateAssetUseCase } from '../../application/create-asset.use-case';
import { UpdateAssetUseCase } from '../../application/update-asset.use-case';
import { RemoveAssetUseCase } from '../../application/remove-asset.use-case';
import { RecordAssetSnapshotsUseCase } from '../../application/record-asset-snapshots.use-case';
import { DismissAssetSuggestionUseCase } from '../../application/dismiss-asset-suggestion.use-case';
import { AssetMapper } from '../mappers/asset.mapper';
import type { AssetHistoryPage } from '../../domain/asset.entity';
import { GlobalExceptionFilter } from '@common/filters/global-exception.filter';
import { AuthGuard } from '@common/guards/auth.guard';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';

const ASSET_ID = '00000000-0000-4000-8000-0000000000c0';
const CURSOR = `1793786400000.1.${ASSET_ID}`;

class MockAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    req.user = {
      id: 'user-http-test',
      email: 'http-test@test.local',
      accessToken: 'mock-token',
      clientKey: Buffer.alloc(32, 0xab),
    };
    req.supabase = {};
    return true;
  }
}

const noop = () => {};
const mockLogger = {
  info: noop,
  error: noop,
  warn: noop,
  debug: noop,
  trace: noop,
  fatal: noop,
  setContext: noop,
} as unknown as PinoLogger;

const page: AssetHistoryPage = {
  asset: {
    id: ASSET_ID,
    categoryId: ASSET_ID,
    name: 'Compte courant',
    currency: 'CHF',
    direction: 'own',
    inPulpe: true,
    archivedAt: null,
    recordedValue: 5_000,
    latestRecordedAt: '2026-11-01T08:00:00.000Z',
    value: 9_420,
    convertedValue: 9_420,
  },
  entries: [
    {
      type: 'movement',
      id: ASSET_ID,
      at: '2026-11-10T10:00:00.000Z',
      name: 'Salaire',
      effect: 6_000,
      supersededAt: null,
    },
  ],
  nextCursor: CURSOR,
};
const getHistory = { execute: mock(() => Promise.resolve(page)) };

let app: INestApplication;

beforeAll(async () => {
  const unused = { useValue: {} };
  const moduleRef = await Test.createTestingModule({
    controllers: [AssetController],
    providers: [
      { provide: GetAssetHistoryUseCase, useValue: getHistory },
      { provide: GetNetWorthUseCase, ...unused },
      { provide: CreateAssetUseCase, ...unused },
      { provide: UpdateAssetUseCase, ...unused },
      { provide: RemoveAssetUseCase, ...unused },
      { provide: RecordAssetSnapshotsUseCase, ...unused },
      { provide: DismissAssetSuggestionUseCase, ...unused },
      AssetMapper,
      { provide: APP_PIPE, useClass: ZodValidationPipe },
      {
        provide: APP_FILTER,
        useFactory: () => new GlobalExceptionFilter(mockLogger),
      },
      { provide: PinoLogger, useValue: mockLogger },
      Reflector,
    ],
  })
    .overrideGuard(AuthGuard)
    .useClass(MockAuthGuard)
    .compile();

  app = moduleRef.createNestApplication();
  app.enableVersioning({ type: VersioningType.URI });
  app.setGlobalPrefix('api');
  await app.init();
});

afterAll(async () => {
  await app?.close();
});

describe('GET /api/v1/assets/:id/history', () => {
  it('answers the asset as on Mon patrimoine and a page, a first page of 30 by default', async () => {
    getHistory.execute.mockClear();

    const res = await request(app.getHttpServer())
      .get(`/api/v1/assets/${ASSET_ID}/history`)
      .expect(200);

    const body = assetHistoryResponseSchema.parse(res.body);
    expect(body.data.asset).toMatchObject({
      latestValue: 9_420,
      recordedValue: 5_000,
      suggestion: null,
    });
    expect(body.data.entries).toEqual(page.entries);
    expect(body.data.nextCursor).toBe(CURSOR);
    expect(getHistory.execute).toHaveBeenCalledWith(
      ASSET_ID,
      { limit: 30 },
      expect.objectContaining({ id: 'user-http-test' }),
    );
  });

  it('passes the limit and the cursor of the previous page', async () => {
    getHistory.execute.mockClear();

    await request(app.getHttpServer())
      .get(`/api/v1/assets/${ASSET_ID}/history?limit=2&cursor=${CURSOR}`)
      .expect(200);

    expect(getHistory.execute).toHaveBeenCalledWith(
      ASSET_ID,
      { limit: 2, cursor: CURSOR },
      expect.anything(),
    );
  });

  it.each(['?cursor=abc', '?cursor=1.2.x', '?limit=0', '?limit=101'])(
    'answers 400 for the query "%s" and reads nothing',
    async (query) => {
      getHistory.execute.mockClear();

      const res = await request(app.getHttpServer())
        .get(`/api/v1/assets/${ASSET_ID}/history${query}`)
        .expect(400);

      expect(res.body.code).toBe('ERR_ZOD_VALIDATION_FAILED');
      expect(getHistory.execute).not.toHaveBeenCalled();
    },
  );

  it('answers 400 for a malformed id', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/assets/not-a-uuid/history')
      .expect(400);
  });

  it('CA15: answers 404 ERR_ASSET_NOT_FOUND for an archived or unknown asset', async () => {
    getHistory.execute.mockImplementationOnce(() =>
      Promise.reject(
        new BusinessException(ERROR_DEFINITIONS.ASSET_NOT_FOUND, {
          id: ASSET_ID,
        }),
      ),
    );

    const res = await request(app.getHttpServer())
      .get(`/api/v1/assets/${ASSET_ID}/history`)
      .expect(404);

    expect(res.body.code).toBe('ERR_ASSET_NOT_FOUND');
  });
});
