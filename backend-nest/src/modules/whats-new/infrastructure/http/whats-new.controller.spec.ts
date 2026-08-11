import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { type INestApplication, VersioningType } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ClsService } from 'nestjs-cls';
import { whatsNewResponseSchema } from 'pulpe-shared';
import request from 'supertest';
import { AuthGuard } from '@common/guards/auth.guard';
import { SupabaseService } from '@modules/supabase/supabase.service';
import { ENCRYPTION_PORT } from '@modules/encryption/encryption.tokens';
import { createMockPinoLogger } from '@/test/test-mocks';
import { GetWhatsNewUseCase } from '../../application/get-whats-new.use-case';
import { WhatsNewController } from './whats-new.controller';

const VALID_CLIENT_KEY = 'ab'.repeat(32);

const supabaseServiceStub = {
  createAuthenticatedClient: () => ({
    auth: {
      getUser: async () => ({
        data: { user: { id: 'user-1', email: 'user@example.com' } },
        error: null,
      }),
    },
  }),
};

let app: INestApplication;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({
    controllers: [WhatsNewController],
    providers: [
      GetWhatsNewUseCase,
      AuthGuard,
      { provide: SupabaseService, useValue: supabaseServiceStub },
      { provide: Reflector, useValue: { getAllAndOverride: () => false } },
      {
        provide: `INFO_LOGGER:${AuthGuard.name}`,
        useValue: createMockPinoLogger(),
      },
      { provide: ClsService, useValue: { set: () => {} } },
      { provide: ENCRYPTION_PORT, useValue: { ensureUserDEK: () => {} } },
    ],
  }).compile();

  app = moduleRef.createNestApplication();
  app.enableVersioning({ type: VersioningType.URI });
  app.setGlobalPrefix('api');
  await app.init();
});

afterAll(async () => {
  await app?.close();
});

describe('GET /api/v1/whats-new/ios', () => {
  it('responds 401 when no bearer token is provided', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/whats-new/ios')
      .query({ currentVersion: '1.1.0', lastSeenVersion: '1.0.4' });

    expect(response.status).toBe(401);
  });

  it('returns a schema-valid payload for an authenticated request', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/whats-new/ios')
      .set('Authorization', 'Bearer valid-token')
      .set('x-client-key', VALID_CLIENT_KEY)
      .query({ currentVersion: '1.1.0', lastSeenVersion: '1.0.4' });

    expect(response.status).toBe(200);
    expect(whatsNewResponseSchema.safeParse(response.body).success).toBe(true);
    expect(response.body.data.entries.length).toBeGreaterThan(0);
  });

  it('returns an empty payload for an authenticated upgrade without release data', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/whats-new/ios')
      .set('Authorization', 'Bearer valid-token')
      .set('x-client-key', VALID_CLIENT_KEY)
      .query({ currentVersion: '1.1.1', lastSeenVersion: '1.1.0' });

    expect(response.status).toBe(200);
    expect(whatsNewResponseSchema.safeParse(response.body).success).toBe(true);
    expect(response.body.data.entries).toEqual([]);
  });
});

describe('GET /api/v1/whats-new/android', () => {
  it('responds 401 when no bearer token is provided', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/whats-new/android')
      .query({ currentVersion: '0.43.0', lastSeenVersion: '0.42.0' });

    expect(response.status).toBe(401);
  });

  it('returns a schema-valid payload for an authenticated request', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/whats-new/android')
      .set('Authorization', 'Bearer valid-token')
      .set('x-client-key', VALID_CLIENT_KEY)
      .query({ currentVersion: '99.99.99', lastSeenVersion: '0.0.0' });

    expect(response.status).toBe(200);
    expect(whatsNewResponseSchema.safeParse(response.body).success).toBe(true);
  });
});
