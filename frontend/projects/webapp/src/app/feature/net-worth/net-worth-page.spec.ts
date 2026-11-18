import {
  Component,
  computed,
  input,
  LOCALE_ID,
  provideZonelessChangeDetection,
  signal,
} from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import type { Asset, NetWorth } from 'pulpe-shared';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { TitleDisplay } from '@core/routing';
import { LoadingIndicator } from '@core/loading/loading-indicator';
import { STORAGE_KEYS, StorageService } from '@core/storage';
import { NetWorthFxNotes } from './components/net-worth-fx-notes';
import { RenameTypeDialog } from './components/rename-type-dialog';
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
    isSaving: signal(false),
    netWorth: {
      status,
      value,
      isInitialLoading: computed(
        () => status() === 'loading' && value() === undefined,
      ),
      isStale: computed(() => status() === 'loading' && value() !== undefined),
    },
    totals: computed(() => value()?.totals ?? null),
    categories: computed(() => value()?.categories ?? []),
    assets: computed(() => value()?.assets ?? []),
    activeAssets: computed(() =>
      (value()?.assets ?? []).filter((asset) => asset.archivedAt === null),
    ),
    archivedAssets: computed(() =>
      (value()?.assets ?? []).filter((asset) => asset.archivedAt !== null),
    ),
    isEmpty: computed(() => (value()?.assets ?? []).length === 0),
    setArchived: vi.fn(),
    saveAsset: vi.fn(),
    renameCategory: vi.fn(),
    dismissSuggestion: vi.fn(),
  };
  const dialogs = { openCreate: vi.fn(), openIntro: vi.fn() };
  const matDialog = { open: vi.fn() };
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
    localStorage.clear();
    status.set('resolved');
    dialogs.openCreate.mockResolvedValue(undefined);
    dialogs.openIntro.mockResolvedValue('close');
    store.setArchived.mockResolvedValue(undefined);
    store.saveAsset.mockResolvedValue(undefined);
    store.dismissSuggestion.mockResolvedValue(undefined);

    await TestBed.configureTestingModule({
      imports: [NetWorthPage],
      providers: [
        provideZonelessChangeDetection(),
        ...provideTranslocoForTest(),
        { provide: LOCALE_ID, useValue: 'fr-FR' },
        { provide: NetWorthStore, useValue: store },
        { provide: NetWorthDialogService, useValue: dialogs },
        { provide: MatDialog, useValue: matDialog },
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

  it('invites to add a first asset when there is none', async () => {
    render({ ...populated, categories: [], assets: [] });

    expect(byTestId('net-worth-empty')).not.toBeNull();
    expect(byTestId('net-worth-hero')).toBeNull();
    expect(byTestId('net-worth-add-button')).toBeNull();

    (
      byTestId('net-worth-empty')!.querySelector('button') as HTMLButtonElement
    ).click();
    expect(dialogs.openCreate).toHaveBeenCalledWith([], []);
  });

  it('shows the API totals, with overdrawn and owe assets on the debts side only', () => {
    render(populated);

    expect(text('net-worth-net')).toContain('6’700');
    expect(text('net-worth-gross')).toContain('10’000');
    expect(text('net-worth-debts')).toContain('3’300');
    expect(byTestId('net-worth-hero')!.classList.contains('hero-warning')).toBe(
      false,
    );

    const [comptes, loans, overdrafts] = sections();
    expect(rowNames(comptes)).toEqual(['UBS']);
    expect(comptes.closest('[data-testid="net-worth-own"]')).not.toBeNull();
    expect(rowNames(loans)).toEqual(['Leasing']);
    expect(loans.getAttribute('aria-label')).toBe('Prêts');
    expect(loans.textContent).toContain('3’000');
    expect(rowNames(overdrafts)).toEqual(['Compte à découvert']);
    expect(overdrafts.getAttribute('aria-label')).toBe('Découverts');
    expect(overdrafts.closest('[data-testid="net-worth-owe"]')).not.toBeNull();
  });

  it('should keep the figures on screen while a write refetches them', () => {
    render(populated);
    status.set('loading');
    fixture.detectChanges();

    expect(byTestId('net-worth-loading')).toBeNull();
    expect(byTestId('net-worth-add-button')).not.toBeNull();
    expect(sections().length).toBeGreaterThan(0);
    expect(TestBed.inject(LoadingIndicator).isLoading()).toBe(true);

    status.set('resolved');
    fixture.detectChanges();
    expect(TestBed.inject(LoadingIndicator).isLoading()).toBe(false);
  });

  it('shows no debts block and no second action when I owe nothing', () => {
    render({
      ...populated,
      totals: { ...populated.totals, debts: 0, net: 10_000 },
      assets: [populated.assets[0]],
    });

    expect(byTestId('net-worth-owe')).toBeNull();
    expect(byTestId('net-worth-categories-button')).toBeNull();
    expect(sections()).toHaveLength(1);
  });

  // Comptes 10'000 + Épargne 2'000 = 12'000 of what I own: 83.3 % and 16.7 %.
  const SAVINGS = '33333333-3333-4333-8333-333333333333';
  const twoOwnTypes: NetWorth = {
    ...populated,
    totals: { ...populated.totals, gross: 12_000, net: 8700 },
    categories: [
      ...populated.categories,
      { id: SAVINGS, name: 'Épargne', total: 2000 },
    ],
    assets: [
      ...populated.assets,
      makeAsset({
        id: 'a5',
        name: 'Livret',
        categoryId: SAVINGS,
        latestValue: 2000,
        convertedValue: 2000,
      }),
    ],
  };
  const shares = () =>
    [
      ...fixture.nativeElement.querySelectorAll(
        '[data-testid="net-worth-section-share"]',
      ),
    ] as HTMLElement[];

  it('should show each owned Type as a rounded share of what I own, in the app locale', () => {
    render(twoOwnTypes);

    expect(
      shares().map(
        (share) => share.querySelector('[aria-hidden="true"]')?.textContent,
      ),
    ).toEqual(['· 83\u00a0%', '· 17\u00a0%']);
    expect(shares()[0].querySelector('.sr-only')?.textContent?.trim()).toBe(
      "83\u00a0% de ce que j'ai",
    );
  });

  it('should keep the shares under 100 % even when debts sink the net worth below zero', () => {
    render({
      ...twoOwnTypes,
      totals: { ...twoOwnTypes.totals, debts: 20_000, net: -8000 },
    });

    expect(shares()).toHaveLength(2);
  });

  it('should hide the share when a single Type holds everything I own', () => {
    render(populated);

    expect(byTestId('net-worth-section-total')).not.toBeNull();
    expect(shares()).toHaveLength(0);
  });

  it('should show the share on owned Types only', () => {
    render(twoOwnTypes);
    byTestId('net-worth-archived-toggle')!.click();
    fixture.detectChanges();

    expect(sections()).toHaveLength(5);
    expect(
      shares().every((share) => share.closest('[data-testid="net-worth-own"]')),
    ).toBe(true);
    expect(shares()).toHaveLength(2);
  });

  it('renames a Type, own or debt, from its header menu', async () => {
    matDialog.open.mockReturnValue({ afterClosed: () => of('Crédits') });
    store.renameCategory.mockResolvedValue(undefined);
    render(populated);

    const buttons = fixture.nativeElement.querySelectorAll(
      '[data-testid="net-worth-type-menu-button"]',
    ) as NodeListOf<HTMLButtonElement>;
    // The overdrafts card is not a Type: only « Comptes » and « Prêts » rename.
    expect(buttons).toHaveLength(2);
    buttons[1].click();
    fixture.detectChanges();
    document
      .querySelector<HTMLElement>(
        '[data-testid="net-worth-type-rename-action"]',
      )!
      .click();
    await fixture.whenStable();

    expect(matDialog.open).toHaveBeenCalledWith(
      RenameTypeDialog,
      expect.objectContaining({ data: { name: 'Prêts' } }),
    );
    expect(store.renameCategory).toHaveBeenCalledWith(LOANS, 'Crédits');
  });

  it('keeps archived assets out until asked, and out of the category sections', () => {
    render(populated);
    expect(text('net-worth-archived-toggle')).toContain('(1)');
    expect(sections()).toHaveLength(3);

    byTestId('net-worth-archived-toggle')!.click();
    fixture.detectChanges();

    expect(sections()).toHaveLength(4);
    expect(rowNames(sections()[3])).toEqual(['Ancien compte']);
  });

  it('should fold a Type to its total and keep it folded on the next visit', () => {
    render(populated);
    const toggle = () =>
      sections()[1].querySelector<HTMLButtonElement>(
        '[data-testid="net-worth-section-toggle"]',
      )!;
    expect(toggle().getAttribute('aria-expanded')).toBe('true');

    toggle().click();
    fixture.detectChanges();

    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    expect(rowNames(sections()[1])).toEqual([]);
    expect(sections()[1].textContent).toContain('3’000');
    expect(rowNames(sections()[0])).toEqual(['UBS']);

    fixture.destroy();
    fixture = TestBed.createComponent(NetWorthPage);
    render(populated);
    expect(rowNames(sections()[1])).toEqual([]);
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

      expect(store.saveAsset).toHaveBeenCalledWith('a1', { value: 3500 });
      expect(store.dismissSuggestion).not.toHaveBeenCalled();
    });

    it('dismisses the suggestion without recording a value', async () => {
      render(withSuggestion);

      click('asset-suggestion-dismiss-button');
      await fixture.whenStable();

      expect(store.dismissSuggestion).toHaveBeenCalledWith('a1');
      expect(store.saveAsset).not.toHaveBeenCalled();
    });

    it('surfaces a refused apply in a snackbar', async () => {
      render(withSuggestion);
      store.saveAsset.mockRejectedValue(new Error('boom'));

      click('asset-suggestion-apply-button');
      await fixture.whenStable();

      expect(snackBar.open).toHaveBeenCalledOnce();
    });
  });

  describe('explainer', () => {
    it('should open by itself once the page settles, then never again on this device', async () => {
      status.set('loading');
      render(undefined);
      expect(dialogs.openIntro).not.toHaveBeenCalled();

      status.set('resolved');
      render(populated);
      await fixture.whenStable();

      expect(dialogs.openIntro).toHaveBeenCalledExactlyOnceWith({
        source: 'auto',
        isEmpty: false,
      });
      expect(
        TestBed.inject(StorageService).get<boolean>(
          STORAGE_KEYS.NET_WORTH_INTRO_SEEN,
        ),
      ).toBe(true);

      render({ ...populated });
      await fixture.whenStable();
      expect(dialogs.openIntro).toHaveBeenCalledOnce();
    });

    it('should not open by itself once seen, nor while loading failed', async () => {
      TestBed.inject(StorageService).set(
        STORAGE_KEYS.NET_WORTH_INTRO_SEEN,
        true,
      );
      render(populated);
      await fixture.whenStable();
      expect(dialogs.openIntro).not.toHaveBeenCalled();

      TestBed.inject(StorageService).remove(STORAGE_KEYS.NET_WORTH_INTRO_SEEN);
      status.set('error');
      render(undefined);
      await fixture.whenStable();
      expect(dialogs.openIntro).not.toHaveBeenCalled();
      expect(byTestId('net-worth-help-button')).toBeNull();
    });

    it('should reopen from « ? » on an empty net worth and lead to the creation form', async () => {
      TestBed.inject(StorageService).set(
        STORAGE_KEYS.NET_WORTH_INTRO_SEEN,
        true,
      );
      render({ ...populated, categories: [], assets: [] });
      dialogs.openIntro.mockResolvedValue('add');

      byTestId('net-worth-help-button')!.click();
      await fixture.whenStable();

      expect(dialogs.openIntro).toHaveBeenCalledWith({
        source: 'help',
        isEmpty: true,
      });
      expect(dialogs.openCreate).toHaveBeenCalledWith([], []);
    });
  });
});
