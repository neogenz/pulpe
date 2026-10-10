import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  mock,
} from 'bun:test';
import {
  type CanActivate,
  type ExecutionContext,
  type INestApplication,
  VersioningType,
} from '@nestjs/common';
import { APP_FILTER, APP_PIPE, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import { PinoLogger } from 'nestjs-pino';
import { ZodValidationPipe } from 'nestjs-zod';
import request from 'supertest';
import { TRANSACTION_IMPORT_MAX_FILE_BYTES } from 'pulpe-shared';
import { GlobalExceptionFilter } from '@common/filters/global-exception.filter';
import { AuthGuard } from '@common/guards/auth.guard';
import { TransactionImportController } from './infrastructure/http/transaction-import.controller';
import { PreviewTransactionImportUseCase } from './application/preview-transaction-import.use-case';
import { ConfirmTransactionImportUseCase } from './application/confirm-transaction-import.use-case';

const BUDGET_ID = '11111111-1111-4111-8111-111111111111';
const PREVIEW = {
  format: 'camt053',
  period: { startDate: '2026-03-01', endDate: '2026-03-31' },
  currency: 'CHF',
  operations: [],
  errors: [],
  budgetLines: [],
};

class MockAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    req.user = { id: 'user-1', clientKey: Buffer.alloc(32, 1) };
    return true;
  }
}

const noop = () => {};
const logger = {
  info: noop,
  error: noop,
  warn: noop,
  debug: noop,
  trace: noop,
  fatal: noop,
  setContext: noop,
} as unknown as PinoLogger;

const previewUseCase = { execute: mock(async () => PREVIEW) };
const confirmUseCase = {
  execute: mock(async () => ({
    createdCount: 3,
    attachedCount: 0,
    skippedCount: 1,
  })),
};

let app: INestApplication;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({
    imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: 1000 }])],
    controllers: [TransactionImportController],
    providers: [
      { provide: PreviewTransactionImportUseCase, useValue: previewUseCase },
      { provide: ConfirmTransactionImportUseCase, useValue: confirmUseCase },
      { provide: APP_PIPE, useClass: ZodValidationPipe },
      {
        provide: APP_FILTER,
        useFactory: () => new GlobalExceptionFilter(logger),
      },
      { provide: PinoLogger, useValue: logger },
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

beforeEach(() => {
  previewUseCase.execute.mockClear();
  confirmUseCase.execute.mockClear();
});

describe('Transaction import HTTP pipeline', () => {
  it('previews an uploaded file, decoded as UTF-8 without its BOM', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/transaction-imports/preview')
      .field('budgetId', BUDGET_ID)
      .attach('file', Buffer.from('﻿<Document>é</Document>', 'utf8'), {
        filename: 'releve.xml',
        contentType: 'application/xml',
      })
      .expect(200);

    expect(res.body).toEqual({ success: true, data: PREVIEW });
    expect(previewUseCase.execute).toHaveBeenCalledWith(
      '<Document>é</Document>',
      BUDGET_ID,
    );
  });

  it('confirms with 201 and the authenticated user', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/transaction-imports')
      .field('budgetId', BUDGET_ID)
      .attach('file', Buffer.from('<Document/>'), 'releve.xml')
      .expect(201);

    expect(res.body.data).toEqual({
      createdCount: 3,
      attachedCount: 0,
      skippedCount: 1,
    });
    expect(confirmUseCase.execute).toHaveBeenCalledWith(
      '<Document/>',
      BUDGET_ID,
      [],
      expect.objectContaining({ id: 'user-1' }),
    );
  });

  it('passes the accepted attachments sent as a JSON field', async () => {
    const decisions = [
      { position: 2, budgetLineId: '22222222-2222-4222-8222-222222222222' },
    ];

    await request(app.getHttpServer())
      .post('/api/v1/transaction-imports')
      .field('budgetId', BUDGET_ID)
      .field('decisions', JSON.stringify(decisions))
      .attach('file', Buffer.from('<Document/>'), 'releve.xml')
      .expect(201);

    expect(confirmUseCase.execute).toHaveBeenCalledWith(
      '<Document/>',
      BUDGET_ID,
      decisions,
      expect.objectContaining({ id: 'user-1' }),
    );
  });

  it('answers 400 for malformed decisions, before any analysis', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/transaction-imports')
      .field('budgetId', BUDGET_ID)
      .field('decisions', '[{"position":0}]')
      .attach('file', Buffer.from('<Document/>'), 'releve.xml')
      .expect(400);

    expect(confirmUseCase.execute).not.toHaveBeenCalled();
  });

  it('answers 400 when the file part is missing', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/transaction-imports/preview')
      .field('budgetId', BUDGET_ID)
      .expect(400);

    expect(res.body.code).toBe('ERR_TRANSACTION_IMPORT_FILE_MISSING');
    expect(previewUseCase.execute).not.toHaveBeenCalled();
  });

  it('answers 400 when the budget id is not a uuid', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/transaction-imports/preview')
      .field('budgetId', 'nope')
      .attach('file', Buffer.from('<Document/>'), 'releve.xml')
      .expect(400);

    expect(previewUseCase.execute).not.toHaveBeenCalled();
  });

  it('answers 413 above the upload ceiling, before any parsing', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/transaction-imports/preview')
      .field('budgetId', BUDGET_ID)
      .attach(
        'file',
        Buffer.alloc(TRANSACTION_IMPORT_MAX_FILE_BYTES + 1, 'a'),
        'releve.xml',
      )
      .expect(413);

    expect(previewUseCase.execute).not.toHaveBeenCalled();
  });
});
