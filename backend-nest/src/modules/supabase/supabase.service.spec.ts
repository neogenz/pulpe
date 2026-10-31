import { describe, expect, it, spyOn } from 'bun:test';
import type { ConfigService } from '@nestjs/config';
import { SupabaseService } from './supabase.service';

const config = {
  get: (key: string) =>
    ({
      SUPABASE_URL: 'http://supabase.test',
      SUPABASE_ANON_KEY: 'anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'service-key',
    })[key],
} as unknown as ConfigService;

describe('SupabaseService', () => {
  it('creates clients that start no auto-refresh timer', async () => {
    const setIntervalSpy = spyOn(globalThis, 'setInterval');
    try {
      const service = new SupabaseService(config);
      const clients = [
        service.getClient(),
        service.createAuthenticatedClient('user-token'),
        service.getServiceRoleClient(),
      ];

      await Promise.all(clients.map((client) => client.auth.initialize()));

      expect(setIntervalSpy).not.toHaveBeenCalled();
    } finally {
      setIntervalSpy.mockRestore();
    }
  });
});
