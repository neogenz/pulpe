import { TestBed } from '@angular/core/testing';
import { McpApi } from '@core/mcp/mcp-api';
import { Logger } from '@core/logging/logger';
import { DataCache } from 'ngx-ziflux';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConnectionsStore } from './connections-store';

const connection = {
  id: '11111111-1111-4111-8111-111111111111',
  clientName: 'ChatGPT',
  mode: 'read_write' as const,
  authorizedAt: '2026-09-06T00:00:00Z',
};

describe('ConnectionsStore cache wiring', () => {
  let store: ConnectionsStore;
  let cache: DataCache;
  const getConnections$ = vi.fn(() => of([connection]));
  const revoke$ = vi.fn(() => of(undefined));

  beforeEach(() => {
    getConnections$.mockClear();
    revoke$.mockReset().mockReturnValue(of(undefined));
    TestBed.configureTestingModule({
      providers: [
        ConnectionsStore,
        { provide: Logger, useValue: { error: vi.fn() } },
        {
          provide: McpApi,
          useFactory: () => ({
            cache: new DataCache(),
            getConnections$,
            revoke$,
          }),
        },
      ],
    });
    cache = TestBed.inject(McpApi).cache;
    cache.set(['connections'], [connection]);
    store = TestBed.inject(ConnectionsStore);
    TestBed.tick();
  });

  it('reuses root connection metadata and removes revoked access from that cache', async () => {
    expect(store.connections()).toEqual([connection]);
    expect(getConnections$).not.toHaveBeenCalled();
    expect(await store.revoke(connection.id)).toBeNull();
    expect(revoke$).toHaveBeenCalledWith(connection.id);
    expect(store.connections()).toEqual([]);
    expect(cache.get(['connections'])?.data).toEqual([]);
  });

  it('preserves the card if revocation fails', async () => {
    revoke$.mockReturnValueOnce(throwError(() => new Error('Unavailable')));
    expect(await store.revoke(connection.id)).toBe(
      'settings.connections.revokeError',
    );
    expect(store.connections()).toEqual([connection]);
    expect(cache.get(['connections'])?.data).toEqual([connection]);
  });
});
