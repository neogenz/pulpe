import {
  Component,
  computed,
  input,
  provideZonelessChangeDetection,
  signal,
} from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import type { Asset, NetWorth } from 'pulpe-shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { TitleDisplay } from '@core/routing';
import { NetWorthFxNotes } from './components/net-worth-fx-notes';
import { NetWorthSankey } from './components/net-worth-sankey';
import NetWorthPage from './net-worth-page';
import { NetWorthDialogService } from './services/net-worth-dialog.service';
import { NetWorthStore } from './services/net-worth-store';

const CHECKING = '11111111-1111-4111-8111-111111111111';
const LOANS = '22222222-2222-4222-8222-222222222222';

function makeAsset(overrides: Partial<Asset> & Pick<Asset, 'id' | 'name'>) {
  return {
    categoryId: CHECKING,
    currency: 'CHF',
    direction: 'own',
    inPulpe: false,
    archivedAt: null,
    latestValue: 0,
    latestRecordedAt: new Date().toISOString(),
    convertedValue: 0,
    suggestion: null,
    ...overrides,
  } satisfies Asset;
}

const populated: NetWorth = {
  totals: {
    baseCurrency: 'CHF',
    gross: 10_000,
    debts: 3300,
    net: 6700,
    incomplete: false,
  },
  categories: [
    { id: CHECKING, name: 'Comptes', total: 10_000 },
    { id: LOANS, name: 'Prêts', total: 0 },
  ],
  assets: [
    makeAsset({
      id: 'a1',
      name: 'UBS',
      latestValue: 10_000,
      convertedValue: 10_000,
      suggestion: null,
    }),
    makeAsset({
      id: 'a2',
      name: 'Compte à découvert',
      latestValue: -300,
      convertedValue: -300,
      suggestion: null,
    }),
    makeAsset({
      id: 'a3',
      name: 'Leasing',
      categoryId: LOANS,
      direction: 'owe',
      latestValue: 3000,
      convertedValue: 3000,
      suggestion: null,
    }),
    makeAsset({
      id: 'a4',
      name: 'Ancien compte',
      latestValue: 50,
      convertedValue: 50,
      suggestion: null,
      archivedAt: '2026-10-01T00:00:00.000Z',
    }),
  ],
};

@Component({ selector: 'pulpe-net-worth-sankey', template: '' })
class SankeyStub {
  readonly netWorth = input.required<NetWorth>();
}

@Component({ selector: 'pulpe-net-worth-fx-notes', template: '' })
class FxNotesStub {
  readonly assets = input.required<readonly Asset[]>();
  readonly baseCurrency = input.required<string>();
}

describe('NetWorthPage', () => {
  let fixture: ComponentFixture<NetWorthPage>;
  const value = signal<NetWorth | undefined>(undefined);
  const status = signal<'loading' | 'resolved' | 'error'>('resolved');
  const store = {
    refresh: vi.fn(),
    netWorth: { status, value },
    totals: computed(() => value()?.totals ?? null),
    categories: computed(() => value()?.categories ?? []),
    activeAssets: computed(() =>
      (value()?.assets ?? []).filter((asset) => asset.archivedAt === null),
    ),
    archivedAssets: computed(() =>
      (value()?.assets ?? []).filter((asset) => asset.archivedAt !== null),
    ),
    isEmpty: computed(() => (value()?.assets ?? []).length === 0),
    setArchived: vi.fn(),
    recordValue: vi.fn(),
    dismissSuggestion: vi.fn(),
  };
  const dialogs = { openCreate: vi.fn() };
  const snackBar = { open: vi.fn() };

  const byTestId = (id: string) =>
    fixture.nativeElement.querySelector(
      `[data-testid="${id}"]`,
    ) as HTMLElement | null;
  const text = (id: string) =>
    byTestId(id)?.textContent?.replace(/\s+/g, ' ').trim() ?? null;
  const rowNames = (section: Element) =>
    [...section.querySelectorAll('[data-testid="asset-row-name"]')].map(
      (element) => element.textContent?.trim(),
    );
  const sections = () =>
    [
      ...fixture.nativeElement.querySelectorAll(
        '[data-testid="net-worth-section"]',
      ),
    ] as HTMLElement[];

  function render(data: NetWorth | undefined): void {
    value.set(data);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    vi.clearAllMocks();
    status.set('resolved');
    dialogs.openCreate.mockResolvedValue(undefined);
    store.setArchived.mockResolvedValue(undefined);
    store.recordValue.mockResolvedValue(undefined);
    store.dismissSuggestion.mockResolvedValue(undefined);

    await TestBed.configureTestingModule({
      imports: [NetWorthPage],
      providers: [
        provideZonelessChangeDetection(),
        ...provideTranslocoForTest(),
        { provide: NetWorthStore, useValue: store },
        { provide: NetWorthDialogService, useValue: dialogs },
        { provide: MatSnackBar, useValue: snackBar },
        {
          provide: TitleDisplay,
          useValue: { currentTitle: signal('Patrimoine') },
        },
      ],
    })
      .overrideComponent(NetWorthPage, {
        remove: { imports: [NetWorthSankey, NetWorthFxNotes] },
        add: { imports: [SankeyStub, FxNotesStub] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(NetWorthPage);
  });

  it('loads on creation', () => {
    render(populated);

    expect(store.refresh).toHaveBeenCalledOnce();
  });

  it('invites to add a first asset when there is none', async () => {
    render({ ...populated, categories: [], assets: [] });

    expect(byTestId('net-worth-empty')).not.toBeNull();
    expect(byTestId('net-worth-hero')).toBeNull();

    (
      byTestId('net-worth-empty')!.querySelector('button') as HTMLButtonElement
    ).click();
    expect(dialogs.openCreate).toHaveBeenCalledWith([]);
  });

  it('shows the API totals, with overdrawn and owe assets on the debts side only', () => {
    render(populated);

    expect(text('net-worth-net')).toContain('6’700');
    expect(text('net-worth-gross')).toContain('10’000');
    expect(text('net-worth-debts')).toContain('3’300');
    expect(byTestId('net-worth-hero')!.classList.contains('hero-warning')).toBe(
      false,
    );

    const [comptes, debts] = sections();
    expect(rowNames(comptes)).toEqual(['UBS']);
    expect(rowNames(debts)).toEqual(['Compte à découvert', 'Leasing']);
  });

  it('keeps archived assets out until asked, and out of the category sections', () => {
    render(populated);
    expect(text('net-worth-archived-toggle')).toContain('(1)');
    expect(sections()).toHaveLength(2);

    byTestId('net-worth-archived-toggle')!.click();
    fixture.detectChanges();

    expect(sections()).toHaveLength(3);
    expect(rowNames(sections()[2])).toEqual(['Ancien compte']);
  });

  it('turns the hero amber, never red, when the net is negative', () => {
    render({
      ...populated,
      totals: { ...populated.totals, gross: 1000, debts: 3300, net: -2300 },
    });

    expect(byTestId('net-worth-hero')!.classList.contains('hero-warning')).toBe(
      true,
    );
    expect(byTestId('net-worth-net')!.classList.contains('amber')).toBe(true);
    expect(text('net-worth-hero')).toContain('dépasse');
  });

  it('tells which assets the total leaves out when a rate is missing', () => {
    render({
      ...populated,
      totals: { ...populated.totals, incomplete: true },
      assets: [
        ...populated.assets,
        makeAsset({
          id: 'a5',
          name: 'Livret EUR',
          currency: 'EUR',
          latestValue: 500,
          convertedValue: null,
        }),
      ],
    });

    const notice = text('net-worth-incomplete');
    expect(notice).toContain('EUR');
    expect(notice).toContain('Livret EUR');
  });

  it('hides the incomplete notice when every asset is converted', () => {
    render(populated);

    expect(byTestId('net-worth-incomplete')).toBeNull();
  });

  it('surfaces a refused write in a snackbar instead of failing silently', async () => {
    render(populated);
    store.setArchived.mockRejectedValue(new Error('boom'));

    await fixture.componentInstance['onAction']({
      asset: populated.assets[0],
      action: 'archive',
    });

    expect(store.setArchived).toHaveBeenCalledWith('a1', true);
    expect(snackBar.open).toHaveBeenCalledOnce();
  });

  describe('suggestion', () => {
    const withSuggestion: NetWorth = {
      ...populated,
      assets: [
        makeAsset({
          id: 'a1',
          name: 'Livret',
          latestValue: 3000,
          convertedValue: 3000,
          suggestion: { delta: 500, proposedValue: 3500 },
        }),
      ],
    };
    const click = (id: string) => byTestId(id)!.click();

    it('applies the proposed value as a new snapshot', async () => {
      render(withSuggestion);

      click('asset-suggestion-apply-button');
      await fixture.whenStable();

      expect(store.recordValue).toHaveBeenCalledWith('a1', 3500);
      expect(store.dismissSuggestion).not.toHaveBeenCalled();
    });

    it('dismisses the suggestion without recording a value', async () => {
      render(withSuggestion);

      click('asset-suggestion-dismiss-button');
      await fixture.whenStable();

      expect(store.dismissSuggestion).toHaveBeenCalledWith('a1');
      expect(store.recordValue).not.toHaveBeenCalled();
    });

    it('surfaces a refused apply in a snackbar', async () => {
      render(withSuggestion);
      store.recordValue.mockRejectedValue(new Error('boom'));

      click('asset-suggestion-apply-button');
      await fixture.whenStable();

      expect(snackBar.open).toHaveBeenCalledOnce();
    });
  });
});
