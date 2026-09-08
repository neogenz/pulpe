import { TestBed } from '@angular/core/testing';
import { DERIVE_CLIENT_KEY, EncryptionApi } from '@core/encryption';
import { McpApi } from '@core/mcp/mcp-api';
import { AnalyticsService } from '@core/analytics/analytics';
import { ANALYTICS_EVENTS } from 'pulpe-shared';
import { of, throwError } from 'rxjs';
import { expect, it, vi } from 'vitest';
import { McpConsentStore } from './mcp-consent-store';

it('defaults to read-only and sends only an explicitly chosen write grant', async () => {
  const approve$ = vi.fn(() =>
    of({ redirectUrl: 'https://client.test/callback' }),
  );
  const derive = vi.fn(async () => 'ab'.repeat(32));
  const captureEvent = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      McpConsentStore,
      { provide: AnalyticsService, useValue: { captureEvent } },
      {
        provide: McpApi,
        useValue: {
          getConsent$: () => of({ clientName: 'ChatGPT' }),
          approve$,
          deny$: () => of({ redirectUrl: 'https://client.test/denied' }),
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
  expect(captureEvent).not.toHaveBeenCalled();
  expect(store.mode()).toBe('read');
  await store.approve('1234');
  expect(derive).toHaveBeenCalledWith('1234', 'salt', 600_000);
  expect(approve$).toHaveBeenLastCalledWith(
    'authorization',
    'read',
    'ab'.repeat(32),
  );
  expect(captureEvent).toHaveBeenCalledExactlyOnceWith(
    ANALYTICS_EVENTS.MCP_CONNECTION_AUTHORIZED,
    { assistant: 'chatgpt', access_mode: 'read' },
    { transport: 'sendBeacon', send_instantly: true },
  );
  store.mode.set('read_write');
  store.clientName.set('Claude Desktop');
  await store.approve('1234');
  expect(approve$).toHaveBeenLastCalledWith(
    'authorization',
    'read_write',
    'ab'.repeat(32),
  );
  expect(captureEvent).toHaveBeenLastCalledWith(
    ANALYTICS_EVENTS.MCP_CONNECTION_AUTHORIZED,
    { assistant: 'claude', access_mode: 'read_write' },
    { transport: 'sendBeacon', send_instantly: true },
  );

  captureEvent.mockClear();
  approve$.mockReturnValueOnce(throwError(() => new Error('Grant refused')));
  await expect(store.approve('1234')).rejects.toThrow('Grant refused');
  await store.deny();
  expect(captureEvent).not.toHaveBeenCalled();

  store.clientName.set('Personal connector alice@example.test secret=1234');
  await store.approve('1234');
  expect(captureEvent).toHaveBeenCalledExactlyOnceWith(
    ANALYTICS_EVENTS.MCP_CONNECTION_AUTHORIZED,
    { assistant: 'other', access_mode: 'read_write' },
    { transport: 'sendBeacon', send_instantly: true },
  );
});
