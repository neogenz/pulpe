import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { type INestApplication, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { appVersionResponseSchema } from 'pulpe-shared';
import request from 'supertest';
import { AppVersionController } from './app-version.controller';

const STUB_ENV = {
  MIN_IOS_VERSION: '1.0.0',
  LATEST_IOS_VERSION: '1.0.2',
  IOS_STORE_URL: 'https://apps.apple.com/app/pulpe',
  MIN_WEB_VERSION: '0.0.1',
  LATEST_WEB_VERSION: '0.34.1',
};

let app: INestApplication;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({
    controllers: [AppVersionController],
    providers: [
      {
        provide: ConfigService,
        useValue: {
          get: (key: string) => STUB_ENV[key as keyof typeof STUB_ENV],
        },
      },
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

describe('GET /api/v1/app/version', () => {
  it('responds 200 without authentication headers', async () => {
    const response = await request(app.getHttpServer()).get(
      '/api/v1/app/version',
    );

    expect(response.status).toBe(200);
  });

  it('returns a payload that matches appVersionResponseSchema', async () => {
    const response = await request(app.getHttpServer()).get(
      '/api/v1/app/version',
    );

    const result = appVersionResponseSchema.safeParse(response.body);
    expect(result.success).toBe(true);
  });

  it('sets a public Cache-Control header for 5 minutes', async () => {
    const response = await request(app.getHttpServer()).get(
      '/api/v1/app/version',
    );

    expect(response.headers['cache-control']).toBe('public, max-age=300');
  });

  it('serves the configured iOS minimum version', async () => {
    const response = await request(app.getHttpServer()).get(
      '/api/v1/app/version',
    );

    expect(response.body.data.ios.minVersion).toBe(STUB_ENV.MIN_IOS_VERSION);
    expect(response.body.data.ios.storeUrl).toBe(STUB_ENV.IOS_STORE_URL);
  });
});
