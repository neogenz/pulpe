import { provideZonelessChangeDetection, signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { describe, it, expect, vi } from 'vitest';
import { of } from 'rxjs';
import type { McpConnection } from 'pulpe-shared';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
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
