import { describe, expect, it } from 'bun:test';
import { Reflector } from '@nestjs/core';
import {
  ThrottlerException,
  ThrottlerGuard,
  ThrottlerStorageService,
} from '@nestjs/throttler';
import { BudgetController } from './infrastructure/http/budget.controller';

const context = () => ({
  getHandler: () => BudgetController.prototype.generate,
  getClass: () => BudgetController,
  switchToHttp: () => ({
    getRequest: () => ({
      ip: '127.0.0.1',
      headers: { 'user-agent': 'bun-test' },
    }),
    getResponse: () => ({ header: () => undefined }),
  }),
});

describe('BudgetController rate limiting', () => {
  it('limits budget generation to five requests per minute', async () => {
    const guard = new ThrottlerGuard(
      {
        throttlers: [{ name: 'default', ttl: 60_000, limit: 1000 }],
      },
      new ThrottlerStorageService(),
      new Reflector(),
    );
    await guard.onModuleInit();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await guard.canActivate(context() as any);
    }

    try {
      await guard.canActivate(context() as any);
      expect.unreachable('Expected the sixth generation request to be limited');
    } catch (error) {
      expect(error).toBeInstanceOf(ThrottlerException);
    }
  });
});
