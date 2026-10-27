import 'reflect-metadata';
import {
  Controller,
  Get,
  Inject,
  Injectable,
  Post,
  Module,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { ClsService } from 'nestjs-cls';
import { deepStrictEqual } from 'node:assert';
import { AsyncLocalStorage } from 'node:async_hooks';
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

  class FixtureConfigService extends ConfigService {
    readConfig() {
      return this.get<string>('mode');
    }
  }

  class FixtureClsService extends ClsService<{ mode: string }> {
    readContext() {
      return this.runWith({ mode: 'local-value' }, () => this.get('mode'));
    }
  }

  @Injectable()
  class LibraryConsumerService {
    constructor(
      @Inject(ConfigService) private readonly config: ConfigService,
      @Inject(ClsService) private readonly cls: ClsService<{ mode: string }>,
      @Inject(FixtureConfigService)
      private readonly childConfig: FixtureConfigService,
      @Inject(FixtureClsService) private readonly childCls: FixtureClsService,
    ) {}

    read() {
      return [
        this.config.get<string>('mode'),
        this.cls.runWith({ mode: 'local-value' }, () => this.cls.get('mode')),
        this.childConfig.readConfig(),
        this.childCls.readContext(),
      ];
    }
  }

  @Controller('privacy')
  class PrivacyController {
    constructor(
      @Inject(LibraryConsumerService)
      private readonly consumer: LibraryConsumerService,
    ) {}

    @Get()
    read() {
      return this.consumer.read();
    }

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
    providers: [
      LibraryConsumerService,
      {
        provide: ConfigService,
        useValue: new ConfigService({ mode: 'local-value' }),
      },
      {
        provide: ClsService,
        useValue: new ClsService(new AsyncLocalStorage()),
      },
      {
        provide: FixtureConfigService,
        useValue: new FixtureConfigService({ mode: 'local-value' }),
      },
      {
        provide: FixtureClsService,
        useValue: new FixtureClsService(new AsyncLocalStorage()),
      },
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
    const success = await fetch(`${await app.getUrl()}/privacy`);
    deepStrictEqual(success.status, 200);
    deepStrictEqual(await success.json(), Array(4).fill('local-value'));
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
