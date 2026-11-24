import {
  LOCALE_ID,
  provideZonelessChangeDetection,
  signal,
} from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideRouter, Router } from '@angular/router';
import type { AssetHistoryResponse } from 'pulpe-shared';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@core/api/api-error';
import { AssetApi } from '@core/asset/asset-api';
import { createMockDataCache } from '@core/testing';
import {
  buildAsset,
  DEBTS_CATEGORY_ID,
  HISTORY_ACCOUNT,
  HISTORY_ENTRIES,
  historyResponse,
  LIVRET,
  movementEntry,
  SAVINGS_CATEGORY_ID,
  snapshotEntry,
} from '@app/testing/net-worth-fixtures';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { NetWorthDialogService } from '../services/net-worth-dialog.service';
import { NetWorthStore } from '../services/net-worth-store';
import AssetDetailPage from './asset-detail-page';

const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

describe('AssetDetailPage', () => {
  let fixture: ComponentFixture<AssetDetailPage>;
  const getHistory$ = vi.fn();
  const categories = [
    { id: SAVINGS_CATEGORY_ID, name: 'Comptes', total: 0 },
    { id: DEBTS_CATEGORY_ID, name: 'Dettes', total: 0 },
  ];
  const netWorth = {
    netWorth: { hasValue: () => true },
    categories: signal(categories),
    assets: signal([HISTORY_ACCOUNT]),
    isSaving: signal(false),
    saveAsset: vi.fn(),
  };
  const dialogs = { openEdit: vi.fn() };

  const byTestId = (id: string) =>
    fixture.nativeElement.querySelector(
      `[data-testid="${id}"]`,
    ) as HTMLElement | null;
  const text = (id: string) =>
    byTestId(id)?.textContent?.replace(/\s+/g, ' ').trim() ?? null;
  const rows = () =>
    [
      ...fixture.nativeElement.querySelectorAll(
        '[data-testid="asset-history-entry"]',
      ),
    ] as HTMLElement[];
  const cell = (row: HTMLElement, id: string) =>
    row
      .querySelector(`[data-testid="${id}"]`)
      ?.textContent?.replace(/\s+/g, ' ')
      .trim() ?? null;
  const column = (id: string) => rows().map((row) => cell(row, id));

  async function render(
    response: AssetHistoryResponse | Error = historyResponse(),
    id: string = HISTORY_ACCOUNT.id,
  ): Promise<void> {
    getHistory$.mockReturnValue(
      response instanceof Error ? throwError(() => response) : of(response),
    );
    fixture = TestBed.createComponent(AssetDetailPage);
    fixture.componentRef.setInput('id', id);
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    vi.clearAllMocks();
    netWorth.saveAsset.mockResolvedValue(undefined);
    dialogs.openEdit.mockResolvedValue(undefined);

    await TestBed.configureTestingModule({
      imports: [AssetDetailPage],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        ...provideTranslocoForTest(),
        { provide: LOCALE_ID, useValue: 'fr-FR' },
        {
          provide: AssetApi,
          useValue: { cache: createMockDataCache(), getHistory$ },
        },
        { provide: NetWorthStore, useValue: netWorth },
        { provide: NetWorthDialogService, useValue: dialogs },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
      ],
    }).compileComponents();
  });

  it('CA2: shows the name, the type, the value today and my last entry', async () => {
    await render();

    expect(getHistory$).toHaveBeenCalledWith(HISTORY_ACCOUNT.id);
    expect(text('page-title')).toBe('Compte courant');
    expect(text('asset-detail-type')).toBe('Comptes');
    expect(text('asset-detail-value')).toBe('9’420.00 CHF');
    expect(text('asset-detail-last-entry')).toMatch(
      /^Ta dernière saisie : 5’000\.00 CHF, le 1er novembre/,
    );
  });

  it('CA3, CA7: lists entries and checked movements newest first, down to the first entry', async () => {
    await render();

    expect(column('asset-history-label')).toEqual([
      'Salaire',
      'Restaurant',
      'Loyer',
      'Valeur enregistrée',
      'Assurance',
      'Valeur enregistrée',
    ]);
  });

  it('CA4: gives each movement its check date and signed effect, each entry its value', async () => {
    await render();

    expect(column('asset-history-amount')).toEqual([
      '+6’000.00 CHF',
      '−80.00 CHF',
      '−1’500.00 CHF',
      '5’000.00 CHF',
      '−300.00 CHF',
      '4’800.00 CHF',
    ]);
    expect(column('asset-history-date')).toEqual([
      expect.stringMatching(/^10 novembre/),
      expect.stringMatching(/^5 novembre/),
      expect.stringMatching(/^3 novembre/),
      expect.stringMatching(/^1er novembre/),
      expect.stringMatching(/^28 octobre/),
      expect.stringMatching(/^1er octobre/),
    ]);
  });

  it('CA5: keeps the movements above my last entry as the ones that make up the value', async () => {
    await render();
    const lastEntry = column('asset-history-label').indexOf(
      'Valeur enregistrée',
    );
    const counted = HISTORY_ENTRIES.slice(0, lastEntry);

    expect(rows().slice(0, lastEntry).some(isSuperseded)).toBe(false);
    expect(
      counted.reduce(
        (sum, entry) =>
          sum + (entry.type === 'movement' ? (entry.effect ?? 0) : 0),
        0,
      ),
    ).toBe(HISTORY_ACCOUNT.latestValue - HISTORY_ACCOUNT.recordedValue);
  });

  it('CA6: mutes a movement placed under an entry and says that entry takes over', async () => {
    await render();
    const assurance = rows()[4];

    expect(isSuperseded(assurance)).toBe(true);
    expect(cell(assurance, 'asset-history-superseded')).toMatch(
      /^Déjà compris dans ta saisie du 1er novembre/,
    );
    expect(rows().filter(isSuperseded)).toHaveLength(1);
  });

  it('CA9: shows a new entry on top, with the earlier movements kept under it', async () => {
    await render(
      historyResponse({
        asset: {
          ...HISTORY_ACCOUNT,
          recordedValue: 9_000,
          latestValue: 9_000,
          latestRecordedAt: '2026-11-12T09:00:00.000Z',
        },
        entries: [
          snapshotEntry(7, '2026-11-12T09:00:00.000Z', 9_000),
          ...HISTORY_ENTRIES.slice(0, 3).map((entry) => ({
            ...entry,
            supersededAt: '2026-11-12T09:00:00.000Z',
          })),
          ...HISTORY_ENTRIES.slice(3),
        ],
      }),
    );

    expect(text('asset-detail-value')).toBe('9’000.00 CHF');
    expect(column('asset-history-label').slice(0, 4)).toEqual([
      'Valeur enregistrée',
      'Salaire',
      'Restaurant',
      'Loyer',
    ]);
    expect(rows().slice(1, 4).every(isSuperseded)).toBe(true);
    expect(byTestId('asset-detail-nothing-since')).not.toBeNull();
  });

  it('CA10: says nothing was checked since the only entry of the Livret', async () => {
    await render(
      historyResponse({
        asset: LIVRET,
        entries: [snapshotEntry(1, LIVRET.latestRecordedAt, 10_000)],
      }),
    );

    expect(text('asset-detail-nothing-since')).toMatch(
      /^info Tu n'as rien pointé depuis ta saisie du 1er novembre/,
    );
    expect(column('asset-history-amount')).toEqual(['10’000.00 CHF']);
  });

  it('does not say nothing was checked when movements count in the value', async () => {
    await render();

    expect(byTestId('asset-detail-nothing-since')).toBeNull();
  });

  it('CA11: waits at the end of the list for the next page while there is one', async () => {
    await render(historyResponse({ nextCursor: 'cursor-1' }));

    expect(rows()).toHaveLength(6);
    expect(
      fixture.nativeElement.querySelector('[aria-hidden="true"].h-px'),
    ).not.toBeNull();
  });

  it('CA12: « Modifier » opens the existing sheet and saves what changed', async () => {
    dialogs.openEdit.mockResolvedValue({ value: 9_000 });
    await render();

    byTestId('asset-detail-edit-button')!.click();
    await settle();

    expect(dialogs.openEdit).toHaveBeenCalledWith(HISTORY_ACCOUNT, categories, [
      HISTORY_ACCOUNT,
    ]);
    expect(netWorth.saveAsset).toHaveBeenCalledWith(HISTORY_ACCOUNT.id, {
      value: 9_000,
    });
  });

  it('CA13: shows a debt in amber with the effects the server kept', async () => {
    await render(
      historyResponse({
        asset: buildAsset({
          name: 'Carte',
          categoryId: DEBTS_CATEGORY_ID,
          direction: 'owe',
          recordedValue: 200,
          latestValue: 100,
        }),
        entries: [
          movementEntry(9, '2026-11-08T09:00:00.000Z', 'Achat', 100),
          movementEntry(8, '2026-11-07T09:00:00.000Z', 'Remboursement', -200),
          movementEntry(10, '2026-11-06T09:00:00.000Z', 'Rien à rembourser', 0),
          snapshotEntry(1, '2026-11-01T09:00:00.000Z', 200),
        ],
      }),
    );

    expect(byTestId('asset-detail-value')!.classList).toContain('amber');
    expect(text('asset-detail-type')).toBe('Dettes');
    expect(column('asset-history-amount').slice(0, 3)).toEqual([
      '+100.00 CHF',
      '−200.00 CHF',
      '0.00 CHF',
    ]);
  });

  it('CA14: shows the effects of a EUR asset in euros, a dash when there was no rate', async () => {
    await render(
      historyResponse({
        asset: { ...HISTORY_ACCOUNT, currency: 'EUR' },
        entries: [
          movementEntry(5, '2026-11-05T09:00:00.000Z', 'Restaurant', -80),
          movementEntry(4, '2026-11-03T09:00:00.000Z', 'Loyer', null),
          snapshotEntry(3, '2026-11-01T09:00:00.000Z', 5_000),
        ],
      }),
    );

    const [restaurant, loyer, entry] = column('asset-history-amount');
    expect(restaurant).toMatch(/^−80,00 €$/);
    expect(loyer).toBe('—');
    expect(entry).toMatch(/^5\s000,00 €$/);
  });

  it('writes a negative value with the real minus sign, as the rows do', async () => {
    await render(
      historyResponse({
        asset: { ...HISTORY_ACCOUNT, latestValue: -150 },
        entries: [snapshotEntry(1, '2026-11-01T09:00:00.000Z', -150)],
      }),
    );

    expect(text('asset-detail-value')).toBe('−150.00 CHF');
    expect(column('asset-history-amount')).toEqual(['−150.00 CHF']);
  });

  it('CA19: shows each time a recurring prévision was checked, even with the same id', async () => {
    await render(
      historyResponse({
        entries: [
          movementEntry(7, '2026-11-12T09:00:00.000Z', 'Courses', -120),
          movementEntry(7, '2026-10-12T09:00:00.000Z', 'Courses', -90),
          snapshotEntry(1, '2026-10-01T09:00:00.000Z', 4_800),
        ],
      }),
    );

    expect(column('asset-history-label')).toEqual([
      'Courses',
      'Courses',
      'Valeur enregistrée',
    ]);
    expect(column('asset-history-amount')).toEqual([
      '−120.00 CHF',
      '−90.00 CHF',
      '4’800.00 CHF',
    ]);
  });

  it('CA15: says an archived or unknown asset is no longer available, with a way back', async () => {
    await render(
      new ApiError('Not found', 'ERR_ASSET_NOT_FOUND', 404, undefined),
    );
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');

    expect(text('page-title')).toBe("Détail de l'élément");
    expect(text('asset-detail-not-found')).toContain(
      "Cet élément n'est plus disponible",
    );
    expect(byTestId('asset-detail-edit-button')).toBeNull();

    byTestId('asset-detail-not-found')!.querySelector('button')!.click();
    expect(navigate).toHaveBeenCalledWith(['/', 'net-worth']);
  });

  it('says an address that is not an asset id leads nowhere, without asking the server', async () => {
    await render(historyResponse(), 'not-a-uuid');

    expect(getHistory$).not.toHaveBeenCalled();
    expect(text('asset-detail-not-found')).toContain(
      "Cet élément n'est plus disponible",
    );
    expect(byTestId('asset-detail-error')).toBeNull();
  });

  it('offers to retry when the history cannot load', async () => {
    await render(new ApiError('Boom', 'ASSET_FETCH_FAILED', 500, undefined));

    expect(text('asset-detail-error')).toContain(
      'Impossible de charger cet historique, réessaie',
    );
    getHistory$.mockReturnValue(of(historyResponse()));
    byTestId('asset-detail-error')!.querySelector('button')!.click();
    await settle();
    fixture.detectChanges();

    expect(rows()).toHaveLength(6);
  });

  it('goes back to « Mon patrimoine »', async () => {
    await render();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');

    byTestId('asset-detail-back-button')!.click();

    expect(navigate).toHaveBeenCalledWith(['/', 'net-worth']);
  });
});

function isSuperseded(row: HTMLElement): boolean {
  return row.classList.contains('superseded');
}
