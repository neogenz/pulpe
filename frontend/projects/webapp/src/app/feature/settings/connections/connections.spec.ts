import { provideZonelessChangeDetection, signal } from '@angular/core';
import { Clipboard } from '@angular/cdk/clipboard';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { describe, it, expect, vi } from 'vitest';
import { of } from 'rxjs';
import type { McpConnection } from 'pulpe-shared';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { ApplicationConfiguration } from '@core/config/application-configuration';
import Connections from './connections';
import { ConnectionsStore } from './connections-store';

const chatgpt: McpConnection = {
  id: '11111111-1111-4111-8111-111111111111',
  clientName: 'ChatGPT',
  mode: 'read_write',
  authorizedAt: '2026-08-23T10:00:00.000Z',
};

describe('Connections', () => {
  let fixture: ComponentFixture<Connections>;
  let store: {
    connections: ReturnType<typeof signal<McpConnection[]>>;
    status: ReturnType<typeof signal<string>>;
    reload: ReturnType<typeof vi.fn>;
    loadActivity: ReturnType<typeof vi.fn>;
    revoke: ReturnType<typeof vi.fn>;
  };
  const dialogResult = { value: true };

  async function setup(connections: McpConnection[]): Promise<void> {
    store = {
      connections: signal(connections),
      status: signal('resolved'),
      reload: vi.fn(),
      loadActivity: vi.fn(async () => []),
      revoke: vi.fn(async (id: string) => {
        store.connections.update((list) => list.filter((c) => c.id !== id));
        return null;
      }),
    };
    await TestBed.configureTestingModule({
      imports: [Connections],
      providers: [
        provideZonelessChangeDetection(),
        provideAnimationsAsync(),
        ...provideTranslocoForTest(),
        {
          provide: ApplicationConfiguration,
          useValue: { backendApiUrl: signal('https://api.pulpe.app/api/v1') },
        },
        {
          provide: MatDialog,
          useValue: {
            open: () => ({ afterClosed: () => of(dialogResult.value) }),
          },
        },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
      ],
    })
      .overrideComponent(Connections, {
        set: { providers: [{ provide: ConnectionsStore, useValue: store }] },
      })
      .compileComponents();
    fixture = TestBed.createComponent(Connections);
    await fixture.whenStable();
  }

  const query = (testId: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(`[data-testid="${testId}"]`);

  it('shows an explicit empty state, not an empty list', async () => {
    await setup([]);
    expect(query('connections-empty')).not.toBeNull();
    expect(query('connections-list')).toBeNull();
  });

  it('keeps setup available for empty, connected, loading and failed lists', async () => {
    await setup([]);
    expect(query('connection-setup')).not.toBeNull();
    store.connections.set([chatgpt]);
    for (const status of ['resolved', 'loading', 'error']) {
      store.status.set(status);
      await fixture.whenStable();
      expect(query('connect-chatgpt')?.getAttribute('href')).toBe(
        'https://chatgpt.com/plugins',
      );
      expect(query('connect-claude')?.getAttribute('rel')).toBe(
        'noopener noreferrer',
      );
    }
  });

  it('prefills only the public name and the current environment MCP endpoint', async () => {
    await setup([]);
    const config = TestBed.inject(ApplicationConfiguration);
    for (const origin of [
      'https://api.pulpe.app',
      'https://api.preview.example',
    ]) {
      config.backendApiUrl.set(origin + '/api/v1');
      await fixture.whenStable();
      const url = new URL(query('connect-claude')!.getAttribute('href')!);
      expect(url.origin + url.pathname).toBe(
        'https://claude.ai/customize/connectors',
      );
      expect(Object.fromEntries(url.searchParams)).toEqual({
        modal: 'add-custom-connector',
        connectorName: 'Pulpe',
        connectorUrl: origin + '/mcp',
      });
      expect(query('mcp-address')?.textContent?.trim()).toBe(origin + '/mcp');
    }
  });

  it('copies the public address and offers manual copying on failure', async () => {
    await setup([]);
    const copy = vi
      .spyOn(TestBed.inject(Clipboard), 'copy')
      .mockReturnValue(true);
    query('copy-mcp-address')!.click();
    await fixture.whenStable();
    expect(copy).toHaveBeenCalledWith('https://api.pulpe.app/mcp');
    expect(query('mcp-copy-status')?.textContent).toContain('Adresse copiée.');
    copy.mockReturnValue(false);
    query('copy-mcp-address')!.click();
    await fixture.whenStable();
    expect(query('mcp-copy-status')?.textContent).toContain(
      'copie-la manuellement',
    );
    copy.mockRestore();
  });

  it('lists each connection with the mode actually granted', async () => {
    await setup([chatgpt, { ...chatgpt, id: 'b', mode: 'read' }]);
    const metas = Array.from(
      fixture.nativeElement.querySelectorAll(
        '[data-testid="connection-meta"]',
      ) as NodeListOf<HTMLElement>,
    ).map((e) => e.textContent);
    expect(metas[0]).toContain('Lecture et écriture');
    expect(metas[1]).toContain('Lecture seule');
  });

  it('keeps the connection when the cut is not confirmed', async () => {
    await setup([chatgpt]);
    dialogResult.value = false;
    (query('connection-revoke-button') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(store.revoke).not.toHaveBeenCalled();
    expect(query('connection-card')).not.toBeNull();
  });

  it('loads the selected connection history and never displays an unknown raw tool key', async () => {
    await setup([chatgpt]);
    store.loadActivity.mockResolvedValue([
      { tool: 'future_tool', outcome: 'ok', createdAt: '2026-09-06T00:00:00Z' },
    ]);
    (query('connection-load-activity') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(store.loadActivity).toHaveBeenCalledWith(chatgpt.id, 5);
    expect(query('connection-activity-row')?.textContent).toContain(
      'Action de l’assistant',
    );
    expect(query('connection-activity-row')?.textContent).not.toContain(
      'future_tool',
    );
  });

  it('drops the card once the cut is confirmed, without reloading', async () => {
    await setup([chatgpt]);
    dialogResult.value = true;
    (query('connection-revoke-button') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(store.revoke).toHaveBeenCalledWith(chatgpt.id);
    expect(store.reload).not.toHaveBeenCalled();
    expect(query('connection-card')).toBeNull();
    expect(query('connections-empty')).not.toBeNull();
  });
});
