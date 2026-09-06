import { TestBed } from '@angular/core/testing';
import { DERIVE_CLIENT_KEY, EncryptionApi } from '@core/encryption';
import { McpApi } from '@core/mcp/mcp-api';
import { of } from 'rxjs';
import { expect, it, vi } from 'vitest';
import { McpConsentStore } from './mcp-consent-store';

it('defaults to read-only and sends only an explicitly chosen write grant', async () => {
  const approve$ = vi.fn(() =>
    of({ redirectUrl: 'https://client.test/callback' }),
  );
  const derive = vi.fn(async () => 'ab'.repeat(32));
  TestBed.configureTestingModule({
    providers: [
      McpConsentStore,
      {
        provide: McpApi,
        useValue: {
          getConsent$: () => of({ clientName: 'ChatGPT' }),
          approve$,
        },
      },
      {
        provide: EncryptionApi,
        useValue: {
          getSalt$: () => of({ salt: 'salt', kdfIterations: 600_000 }),
        },
      },
      { provide: DERIVE_CLIENT_KEY, useValue: derive },
    ],
  });
  const store = TestBed.inject(McpConsentStore);
  await store.load('authorization');
  expect(store.mode()).toBe('read');
  await store.approve('1234');
  expect(derive).toHaveBeenCalledWith('1234', 'salt', 600_000);
  expect(approve$).toHaveBeenLastCalledWith(
    'authorization',
    'read',
    'ab'.repeat(32),
  );
  store.mode.set('read_write');
  await store.approve('1234');
  expect(approve$).toHaveBeenLastCalledWith(
    'authorization',
    'read_write',
    'ab'.repeat(32),
  );
});
