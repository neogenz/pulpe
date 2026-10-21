import 'reflect-metadata';
import { Controller, Post, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { gunzipSync } from 'node:zlib';
import { createServer, get } from 'node:http';
import { once } from 'node:events';
import {
  ObserveInstrument,
  ObserveModule,
  observePrivacyOptions,
} from '../../observe';

async function verifyPrivacy() {
  const batches: unknown[] = [];
  const collector = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    if (chunks.length) {
      const bytes = Buffer.concat(chunks);
      batches.push(
        JSON.parse(
          (req.headers['content-encoding'] === 'gzip'
            ? gunzipSync(bytes)
            : bytes
          ).toString(),
        ),
      );
    }
    res.end('{}');
  });
  collector.listen(0, '127.0.0.1');
  await once(collector, 'listening');
  const address = collector.address();
  if (!address || typeof address === 'string')
    throw new Error('Missing collector port');
  const endpoint = `http://127.0.0.1:${address.port}`;

  const outgoing = (url: string) =>
    new Promise<void>((resolve, reject) => {
      get(url, (res) => {
        res.resume();
        res.on('end', resolve);
      }).on('error', reject);
    });

  @Controller('privacy')
  class PrivacyController {
    @Post(':id')
    async fail() {
      await outgoing(
        `${endpoint}/rest/v1/transaction?select=id&user_id=eq.12345678-1234-1234-1234-123456789abc&name=ilike.private-merchant&or=(amount.eq.9876.54)`,
      );
      await outgoing(
        `${endpoint}/rest/v1/transaction?unknown_filter=private-filter`,
      );
      await outgoing(`${endpoint}/auth/v1/users/private-user`);
      throw new Error(
        "Database write failed (23505): email=alice@example.invalid amount=9876.54; user=abcdef12-1234-1234-1234-123456789abc; /search?q=private-query; A tag named 'private-label's budget' already exists; Key (name)=(private-row) already exists; token=private-token",
      );
    }
  }

  @Module({
    imports: [
      ObserveModule.forRoot({
        ...observePrivacyOptions,
        serviceId: 'privacy-test',
        endpoint,
        appKey: 'local-test',
        appSecret: 'local-test',
        flushInterval: 50,
        runtimeMetrics: false,
      }),
    ],
    controllers: [PrivacyController],
  })
  class PrivacyModule {}

  const app = await NestFactory.create(PrivacyModule, {
    instrument: ObserveInstrument,
    logger: false,
  });
  try {
    await app.listen(0, '127.0.0.1');
    await fetch(
      `${await app.getUrl()}/privacy/private-path?search=private-search`,
      {
        method: 'POST',
        body: JSON.stringify({ description: 'private-body' }),
        headers: {
          'content-type': 'application/json',
          'x-request-id': 'private-request-id',
          referer: 'https://example.invalid/private-referrer',
          authorization: 'Bearer private-bearer',
        },
      },
    );
    await fetch(`${await app.getUrl()}/private-missing-path`);
    await new Promise((resolve) => setTimeout(resolve, 300));
  } finally {
    await app.close();
    collector.closeAllConnections();
    collector.close();
  }
  process.stdout.write(`OBSERVE_TEST_PAYLOAD=${JSON.stringify(batches)}\n`);
}
void verifyPrivacy();
