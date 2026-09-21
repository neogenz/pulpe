import { Controller, Get, INestApplication, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { afterEach, describe, expect, it } from 'bun:test';
import { createConnection } from 'node:net';
import request from 'supertest';
import { REQUEST_ID_HEADER } from 'pulpe-shared';
import { UUID_V4_PATTERN } from '@common/utils/request-id';
import {
  createRateLimitIpKey,
  setupCors,
  setupCorsOriginGuard,
  setupEarlyRequestId,
  setupRequestProtection,
} from './main';

@Controller('probe')
class ProbeController {
  @Get()
  getProbe() {
    return { ok: true };
  }

  @Get('blog')
  getBlog() {
    return { section: 'blog' };
  }
}

@Controller('mcp')
class McpController {
  @Get()
  getMcp() {
    return { transport: 'mcp' };
  }
}

@Module({ controllers: [ProbeController, McpController] })
class ProbeModule {}

interface TestAppOptions {
  requestLimit?: number;
  nodeEnv?: string;
  railwayEnvironmentName?: string | null;
  registerOAuthStub?: boolean;
}

const createApp = async ({
  requestLimit,
  nodeEnv = 'production',
  railwayEnvironmentName = 'production',
  registerOAuthStub = false,
}: TestAppOptions = {}): Promise<INestApplication> => {
  const moduleRef = await Test.createTestingModule({
    imports: [ProbeModule],
    providers: [
      {
        provide: ConfigService,
        useValue: {
          get: (key: string, defaultValue?: unknown) =>
            ({
              NODE_ENV: nodeEnv,
              RAILWAY_ENVIRONMENT_NAME: railwayEnvironmentName,
              CORS_ORIGIN: 'https://app.pulpe.app',
            })[key] ?? defaultValue,
        },
      },
    ],
  }).compile();

  const app = moduleRef.createNestApplication();
  setupEarlyRequestId(app);
  if (registerOAuthStub) {
    app
      .getHttpAdapter()
      .post('/token', (_req: unknown, res: any) =>
        res.status(200).json({ ok: true }),
      );
  }
  setupCors(app);
  if (requestLimit !== undefined) {
    setupRequestProtection(app, requestLimit);
  }
  setupCorsOriginGuard(app);
  await app.init();
  return app;
};

const sendRawHttpRequest = async (
  port: number,
  requestTarget: string,
): Promise<string> =>
  new Promise((resolve, reject) => {
    let response = '';
    const socket = createConnection({ host: '127.0.0.1', port }, () => {
      socket.write(
        `GET ${requestTarget} HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n`,
      );
    });
    socket.on('data', (chunk) => {
      response += chunk.toString();
    });
    socket.on('end', () => resolve(response));
    socket.on('error', reject);
  });

describe('HTTP perimeter', () => {
  let app: INestApplication | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('returns 403 instead of 500 for a rejected REST origin', async () => {
    app = await createApp();

    const response = await request(app.getHttpServer())
      .get('/probe')
      .set('Origin', 'https://attacker.example')
      .expect(REQUEST_ID_HEADER, UUID_V4_PATTERN)
      .expect(403);

    expect(response.body).toEqual({
      statusCode: 403,
      code: 'CORS_ORIGIN_DENIED',
      message: 'Origin is not allowed.',
    });
  });

  it('rate limits rejected-origin probes before returning CORS denials', async () => {
    app = await createApp({ requestLimit: 1 });
    const server = app.getHttpServer();

    await request(server)
      .get('/totally-missing')
      .set('Origin', 'https://attacker.example')
      .expect(403);
    await request(server)
      .get('/totally-missing')
      .set('Origin', 'https://attacker.example')
      .expect(429);
  });

  it('keeps allowed origins functional', async () => {
    app = await createApp();

    await request(app.getHttpServer())
      .get('/probe')
      .set('Origin', 'https://app.pulpe.app')
      .expect('access-control-allow-origin', 'https://app.pulpe.app')
      .expect(200, { ok: true });
  });

  it('accepts only structurally valid Pulpe Vercel preview origins', async () => {
    app = await createApp();
    const server = app.getHttpServer();

    await request(server)
      .get('/probe')
      .set(
        'Origin',
        'https://pulpe-frontend-git-fix-abc-maximes-projects-56d66b35.vercel.app',
      )
      .expect(200, { ok: true });
    await request(server)
      .get('/probe')
      .set(
        'Origin',
        'https://pulpe-frontend-branch/-maximes-projects-team.vercel.app',
      )
      .expect(403);
    await request(server)
      .get('/probe')
      .set(
        'Origin',
        'https://pulpe-frontend-a-maximes-projects-random-attacker-scope.vercel.app',
      )
      .expect(403);
  });

  it('rejects WordPress probes before application routing', async () => {
    app = await createApp({ requestLimit: 100 });

    const response = await request(app.getHttpServer())
      .post('/wordpress/wp-json/batch/v1')
      .expect(404);

    expect(response.body).toEqual({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'Not found.',
    });
  });

  it('rejects query-form WordPress probes without blocking legitimate blog routes', async () => {
    app = await createApp({ requestLimit: 100 });
    const server = app.getHttpServer();

    await request(server)
      .get('/probe?rest_route=%2Fwp%2Fv2%2Fusers')
      .expect(404, {
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Not found.',
      });
    await request(server).get('/assets/%77p-json/users').expect(404, {
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'Not found.',
    });
    await request(server).get('/probe/blog').expect(200, { section: 'blog' });
  });

  it('treats malformed request targets as ordinary unknown routes', async () => {
    app = await createApp({ requestLimit: 300 });
    await app.listen(0, '127.0.0.1');
    const port = Number(new URL(await app.getUrl()).port);

    const response = await sendRawHttpRequest(port, '//%');

    expect(response).toStartWith('HTTP/1.1 404');
  });

  it('rate limits nonexistent-route traffic by validated client IP', async () => {
    app = await createApp({ requestLimit: 2 });
    const server = app.getHttpServer();

    await request(server)
      .get('/totally-missing')
      .set('X-Real-IP', '203.0.113.10')
      .expect(404);
    await request(server)
      .get('/totally-missing')
      .set('X-Real-IP', '203.0.113.10')
      .expect(404);
    await request(server)
      .get('/totally-missing')
      .set('X-Real-IP', '203.0.113.10')
      .expect(429);
    await request(server)
      .get('/totally-missing')
      .set('X-Real-IP', '203.0.113.11')
      .expect(404);
  });

  it('rate limits unknown routes inside valid-looking namespaces', async () => {
    app = await createApp({ requestLimit: 1 });
    const server = app.getHttpServer();
    const targets = [
      '/api/v1/totally-missing',
      '/API/v1/totally-missing',
      '/api/openapi/totally-missing',
      '/health/totally-missing',
      '/.well-known/oauth-protected-resource/totally-missing',
      '/api/v10/totally-missing',
    ];

    for (const [index, target] of targets.entries()) {
      const clientIp = `203.0.113.${index + 10}`;
      await request(server).get(target).set('X-Real-IP', clientIp).expect(404);
      await request(server).get(target).set('X-Real-IP', clientIp).expect(429);
    }

    await request(server)
      .post('/')
      .set('X-Real-IP', '203.0.113.30')
      .expect(404);
    await request(server)
      .post('/')
      .set('X-Real-IP', '203.0.113.30')
      .expect(429);
  });

  it('ignores spoofed proxy IP headers outside Railway', async () => {
    app = await createApp({
      requestLimit: 2,
      nodeEnv: 'production',
      railwayEnvironmentName: null,
    });
    const server = app.getHttpServer();

    await request(server)
      .get('/totally-missing')
      .set('X-Real-IP', '203.0.113.10')
      .expect(404);
    await request(server)
      .get('/totally-missing')
      .set('X-Real-IP', '203.0.113.11')
      .expect(404);
    await request(server)
      .get('/totally-missing')
      .set('X-Real-IP', '203.0.113.12')
      .expect(429);
  });

  it('builds shared REST and MCP rate-limit keys from Railway provenance only', () => {
    const req = {
      headers: { 'x-real-ip': '203.0.113.10' },
      ip: '127.0.0.1',
    } as unknown as Parameters<ReturnType<typeof createRateLimitIpKey>>[0];

    expect(createRateLimitIpKey(false)(req)).toBe('127.0.0.1');
    expect(createRateLimitIpKey(true)(req)).toBe('203.0.113.10');
  });

  it('preserves CORS headers on rate-limit responses', async () => {
    app = await createApp({ requestLimit: 1 });
    const server = app.getHttpServer();

    await request(server)
      .get('/totally-missing')
      .set('Origin', 'https://app.pulpe.app')
      .expect(404);
    await request(server)
      .get('/totally-missing')
      .set('Origin', 'https://app.pulpe.app')
      .set(REQUEST_ID_HEADER, '123e4567-e89b-42d3-a456-426614174000')
      .expect('access-control-allow-origin', 'https://app.pulpe.app')
      .expect(REQUEST_ID_HEADER, '123e4567-e89b-42d3-a456-426614174000')
      .expect(429);
  });

  it('does not aggregate OAuth endpoints into the REST perimeter bucket', async () => {
    app = await createApp({ requestLimit: 1, registerOAuthStub: true });
    const server = app.getHttpServer();

    await request(server)
      .post('/token')
      .expect(REQUEST_ID_HEADER, UUID_V4_PATTERN)
      .expect(200, { ok: true });
    await request(server)
      .post('/token')
      .expect(REQUEST_ID_HEADER, UUID_V4_PATTERN)
      .expect(200, { ok: true });
  });

  it('preserves the separate MCP CORS and rate-limit policy', async () => {
    app = await createApp({ requestLimit: 1 });
    const server = app.getHttpServer();

    await request(server)
      .get('/mcp')
      .set('Origin', 'https://agent.example')
      .expect('access-control-allow-origin', '*')
      .expect(200, { transport: 'mcp' });
    await request(server)
      .get('/MCP')
      .set('Origin', 'https://agent.example')
      .expect('access-control-allow-origin', '*')
      .expect(200, { transport: 'mcp' });
  });
});
